// Entrypoint for the daily server-side reminder evaluation job
// (contracts/evaluate-reminders-function.md). Invoked by pg_cron via
// pg_net (supabase/migrations/0004_push_tokens.sql), never by client apps.
import { withCronMonitor } from "./sentry.ts";
import {
  createServiceRoleClient,
  fetchEnabledRules,
  fetchPlannedExpenses,
  fetchNotificationLogFor,
  insertServerNotificationLog,
  fetchPushTokensForUsers,
  fetchTokensWithPendingReceipt,
  deletePushTokensByIds,
  clearPendingReceipt,
  recordSentTicket,
} from "./db.ts";
import { sendPushBatch, getReceipts, type ExpoPushMessage } from "./expoPush.ts";
import {
  computeDesiredNotifications,
  filterUndelivered,
  getTodayIso,
} from "../../../src/features/rules/notificationEngine.ts";

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

function groupByUserId<T extends { user_id: string }>(items: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const bucket = groups.get(item.user_id) ?? [];
    bucket.push(item);
    groups.set(item.user_id, bucket);
  }
  return groups;
}

// Phase 1 (research.md #4, FR-006): resolve receipts for whatever was sent
// on the *previous* run and prune devices confirmed unreachable, before
// evaluating/sending anything new.
async function pruneStaleTokens(client: ServiceClient): Promise<number> {
  const pending = await fetchTokensWithPendingReceipt(client);
  if (pending.length === 0) {
    return 0;
  }

  const ticketIds = pending
    .map((token) => token.last_ticket_id)
    .filter((id): id is string => id !== null);
  const receipts = await getReceipts(ticketIds);

  const staleIds: string[] = [];
  const clearedIds: string[] = [];
  for (const token of pending) {
    const receipt = token.last_ticket_id ? receipts[token.last_ticket_id] : undefined;
    if (!receipt) {
      // Not ready yet (Expo recommends checking minutes-to-hours later) —
      // leave last_ticket_id in place for tomorrow's check.
      continue;
    }
    if (receipt.status === "error" && receipt.details?.error === "DeviceNotRegistered") {
      staleIds.push(token.id);
    } else {
      clearedIds.push(token.id);
    }
  }

  await deletePushTokensByIds(client, staleIds);
  await Promise.all(clearedIds.map((id) => clearPendingReceipt(client, id)));
  return staleIds.length;
}

// Phase 2 (FR-002/003/004/005): evaluate every user's rules against their
// planned expenses, dedupe against notifications_log (any channel), and
// send whatever's left via Expo push.
async function evaluateAndSend(
  client: ServiceClient
): Promise<{ sent: number; skippedDuplicates: number }> {
  const [rules, expenses] = await Promise.all([
    fetchEnabledRules(client),
    fetchPlannedExpenses(client),
  ]);
  const todayIso = getTodayIso();

  const rulesByUser = groupByUserId(rules);
  const expensesByUser = groupByUserId(expenses);
  const userIds = new Set([...rulesByUser.keys(), ...expensesByUser.keys()]);

  let sent = 0;
  let skippedDuplicates = 0;

  for (const userId of userIds) {
    const userRules = rulesByUser.get(userId) ?? [];
    const userExpenses = expensesByUser.get(userId) ?? [];
    if (userRules.length === 0 || userExpenses.length === 0) {
      continue;
    }

    // computeDesiredNotifications assumes a single user's rules/expenses
    // (it does no ownership filtering itself) — grouping by user_id before
    // calling it, exactly like the app does via RLS-scoped queries, is what
    // keeps one user's rule from ever matching another user's expense here.
    const candidates = computeDesiredNotifications(userRules, userExpenses, todayIso);
    if (candidates.length === 0) {
      continue;
    }

    const allExpenseIds = candidates.flatMap((candidate) => candidate.expenseIds);
    const existingLog = await fetchNotificationLogFor(client, allExpenseIds);
    const undelivered = filterUndelivered(candidates, existingLog);
    skippedDuplicates += candidates.length - undelivered.length;
    if (undelivered.length === 0) {
      continue;
    }

    const tokens = await fetchPushTokensForUsers(client, [userId]);
    if (tokens.length === 0) {
      continue;
    }

    const messages: ExpoPushMessage[] = [];
    for (const candidate of undelivered) {
      for (const token of tokens) {
        messages.push({
          to: token.expo_push_token,
          title: candidate.title,
          body: candidate.body,
          data: {
            ruleId: candidate.ruleId,
            expenseIds: candidate.expenseIds,
            triggerKind: candidate.triggerKind,
          },
        });
      }
    }

    const tickets = await sendPushBatch(messages);

    // messages/tickets are aligned candidate-major, token-minor (built in
    // lockstep above) — walk them back in the same order to attribute each
    // ticket to its (candidate, token) pair.
    let ticketIndex = 0;
    const logRows: Array<{ userId: string; expenseId: string; ruleId: string; triggerKind: string }> =
      [];
    for (const candidate of undelivered) {
      let deliveredToAnyDevice = false;
      for (const token of tokens) {
        const ticket = tickets[ticketIndex++];
        if (ticket?.status === "ok" && ticket.id) {
          deliveredToAnyDevice = true;
          await recordSentTicket(client, token.id, ticket.id);
        }
      }
      if (deliveredToAnyDevice) {
        sent += 1;
        for (const expenseId of candidate.expenseIds) {
          logRows.push({
            userId,
            expenseId,
            ruleId: candidate.ruleId,
            triggerKind: candidate.triggerKind,
          });
        }
      }
    }
    await insertServerNotificationLog(client, logRows);
  }

  return { sent, skippedDuplicates };
}

Deno.serve(async (req: Request) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!cronSecret || req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const summary = await withCronMonitor(async () => {
      const client = createServiceRoleClient();
      const prunedTokens = await pruneStaleTokens(client);
      const { sent, skippedDuplicates } = await evaluateAndSend(client);
      return { sent, pruned_tokens: prunedTokens, skipped_duplicates: skippedDuplicates };
    });

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("evaluate-reminders failed", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
