// Service-role Supabase client + queries for the evaluate-reminders Edge
// Function (contracts/evaluate-reminders-function.md). Bypasses RLS by
// design — this runs as a trusted, cron-triggered backend job, not on
// behalf of any single signed-in user (research.md #1).
import { createClient } from "npm:@supabase/supabase-js@2";
import type { Expense } from "../../../src/features/expenses/types.ts";
import type { Rule } from "../../../src/features/rules/types.ts";
import type { NotificationLogKey } from "../../../src/features/rules/notificationEngine.ts";

export interface PushTokenRow {
  id: string;
  user_id: string;
  device_installation_id: string;
  expo_push_token: string;
  platform: "ios" | "android";
  last_ticket_id: string | null;
  last_ticket_sent_at: string | null;
}

export function createServiceRoleClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type SupabaseServiceClient = ReturnType<typeof createServiceRoleClient>;

export async function fetchEnabledRules(client: SupabaseServiceClient): Promise<Rule[]> {
  const { data, error } = await client.from("rules").select("*").eq("enabled", true);
  if (error) throw error;
  return data ?? [];
}

export async function fetchPlannedExpenses(client: SupabaseServiceClient): Promise<Expense[]> {
  const { data, error } = await client.from("expenses").select("*").eq("status", "planned");
  if (error) throw error;
  return data ?? [];
}

export async function fetchNotificationLogFor(
  client: SupabaseServiceClient,
  expenseIds: string[]
): Promise<NotificationLogKey[]> {
  if (expenseIds.length === 0) return [];
  const { data, error } = await client
    .from("notifications_log")
    .select("expense_id, rule_id, trigger_kind")
    .in("expense_id", expenseIds);
  if (error) throw error;
  return (data ?? [])
    .filter((row) => row.expense_id !== null && row.rule_id !== null)
    .map((row) => ({
      expenseId: row.expense_id as string,
      ruleId: row.rule_id as string,
      triggerKind: row.trigger_kind,
    }));
}

export async function insertServerNotificationLog(
  client: SupabaseServiceClient,
  rows: Array<{ userId: string; expenseId: string; ruleId: string; triggerKind: string }>
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await client.from("notifications_log").insert(
    rows.map((row) => ({
      user_id: row.userId,
      expense_id: row.expenseId,
      rule_id: row.ruleId,
      trigger_kind: row.triggerKind,
      channel: "server",
    }))
  );
  if (error) throw error;
}

export async function fetchPushTokensForUsers(
  client: SupabaseServiceClient,
  userIds: string[]
): Promise<PushTokenRow[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await client.from("push_tokens").select("*").in("user_id", userIds);
  if (error) throw error;
  return data ?? [];
}

export async function fetchTokensWithPendingReceipt(
  client: SupabaseServiceClient
): Promise<PushTokenRow[]> {
  const { data, error } = await client
    .from("push_tokens")
    .select("*")
    .not("last_ticket_id", "is", null);
  if (error) throw error;
  return data ?? [];
}

export async function deletePushTokensByIds(
  client: SupabaseServiceClient,
  ids: string[]
): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await client.from("push_tokens").delete().in("id", ids);
  if (error) throw error;
}

export async function clearPendingReceipt(
  client: SupabaseServiceClient,
  id: string
): Promise<void> {
  const { error } = await client
    .from("push_tokens")
    .update({ last_ticket_id: null, last_ticket_sent_at: null })
    .eq("id", id);
  if (error) throw error;
}

export async function recordSentTicket(
  client: SupabaseServiceClient,
  id: string,
  ticketId: string
): Promise<void> {
  const { error } = await client
    .from("push_tokens")
    .update({ last_ticket_id: ticketId, last_ticket_sent_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
