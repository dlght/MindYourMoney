import type { Expense } from "../expenses/types.ts";
import { toCents } from "../../lib/money.ts";
import type { NotificationCandidate, NotificationTriggerKind, Rule } from "./types.ts";

// Relative imports with explicit .ts extensions (rather than this project's
// usual "@/..." alias) are deliberate here, not an oversight: this module is
// imported directly by supabase/functions/evaluate-reminders/index.ts (Deno,
// research.md #2 — one source of truth for rule-matching shared between the
// app and the server-side evaluator), and Deno's module resolution requires
// explicit extensions and doesn't understand the app's bundler-only alias.
// `allowImportingTsExtensions` is enabled in tsconfig.json so this still
// type-checks under `tsc --noEmit`; Metro resolves the explicit-extension
// relative paths the same as it always has.

export function getTodayIso(referenceDate: Date = new Date()): string {
  return toIsoDate(referenceDate);
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(isoDate: string, days: number): string {
  const date = parseIsoDate(isoDate);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

function isPlanned(expense: Expense): boolean {
  return expense.status === "planned";
}

function matchesRule(rule: Rule, expense: Expense): boolean {
  if (rule.min_amount !== null && toCents(expense.amount) < toCents(rule.min_amount)) {
    return false;
  }
  if (rule.category_ids !== null && !rule.category_ids.includes(expense.category_id)) {
    return false;
  }
  return true;
}

interface RawCandidate {
  rule: Rule;
  expense: Expense;
  triggerKind: NotificationTriggerKind;
  triggerDateIso: string;
}

function triggerPoints(rule: Rule): Array<{ kind: "primary" | "repeat"; daysBefore: number }> {
  const points: Array<{ kind: "primary" | "repeat"; daysBefore: number }> = [
    { kind: "primary", daysBefore: rule.days_before },
  ];
  if (rule.repeat_days_before !== null) {
    points.push({ kind: "repeat", daysBefore: rule.repeat_days_before });
  }
  return points;
}

function formatAmount(expense: Expense): string {
  return `${expense.currency} ${expense.amount.toFixed(2)}`;
}

function perExpenseContent(
  rule: Rule,
  expense: Expense,
  triggerKind: NotificationTriggerKind
): { title: string; body: string } {
  const title = rule.name;
  const body =
    triggerKind === "repeat"
      ? `${expense.name} (${formatAmount(expense)}) is still due on ${expense.due_date} — don't forget!`
      : `${expense.name} (${formatAmount(expense)}) is due on ${expense.due_date}.`;
  return { title, body };
}

function groupedContent(rule: Rule, expenses: Expense[]): { title: string; body: string } {
  const title = rule.name;
  if (expenses.length === 1) {
    const [expense] = expenses;
    return { title, body: `${expense.name} (${formatAmount(expense)}) is due tomorrow.` };
  }
  const names = expenses.map((expense) => expense.name).join(", ");
  const totalCents = expenses.reduce((sum, expense) => sum + toCents(expense.amount), 0);
  const currency = expenses[0]?.currency ?? "EUR";
  const total = (totalCents / 100).toFixed(2);
  return {
    title,
    body: `${expenses.length} expenses due tomorrow: ${names} — total ${currency} ${total}.`,
  };
}

/**
 * Pure computation of the full set of local notifications that SHOULD
 * exist right now, given the current rules and planned expenses
 * (research.md #2). Never touches the OS notification tray or the
 * database directly — that's notificationScheduler.ts's job.
 */
export function computeDesiredNotifications(
  rules: Rule[],
  expenses: Expense[],
  todayIso: string
): NotificationCandidate[] {
  const plannedExpenses = expenses.filter(isPlanned);
  const enabledRules = rules.filter((rule) => rule.enabled);

  const raw: RawCandidate[] = [];
  for (const rule of enabledRules) {
    const matching = plannedExpenses.filter((expense) => matchesRule(rule, expense));
    for (const point of triggerPoints(rule)) {
      for (const expense of matching) {
        const triggerDateIso = addDays(expense.due_date, -point.daysBefore);
        if (triggerDateIso < todayIso) {
          // FR-009: never schedule for a trigger point already in the past.
          continue;
        }
        raw.push({ rule, expense, triggerKind: point.kind, triggerDateIso });
      }
    }
  }

  const perExpenseRaw = raw.filter((candidate) => !candidate.rule.is_grouped);
  const groupedRaw = raw.filter((candidate) => candidate.rule.is_grouped);

  // Dedupe among per-expense candidates: at most one notification per
  // expense per trigger date, even if multiple enabled rules match
  // (FR-011) — first matching rule (by input order) wins, deterministically.
  const claimed = new Map<string, RawCandidate>();
  for (const candidate of perExpenseRaw) {
    const key = `${candidate.expense.id}:${candidate.triggerDateIso}`;
    if (!claimed.has(key)) {
      claimed.set(key, candidate);
    }
  }

  const candidates: NotificationCandidate[] = [];

  for (const candidate of claimed.values()) {
    const { rule, expense, triggerKind, triggerDateIso } = candidate;
    const { title, body } = perExpenseContent(rule, expense, triggerKind);
    candidates.push({
      identifier: `expense:${expense.id}:rule:${rule.id}:${triggerKind}`,
      ruleId: rule.id,
      triggerKind,
      triggerDateIso,
      title,
      body,
      expenseIds: [expense.id],
    });
  }

  // Grouped candidates: bucket by (rule, triggerKind, triggerDateIso), then
  // drop any expense already claimed by a more specific per-expense
  // reminder on that same date; drop the whole bucket if nothing is left.
  const groupedBuckets = new Map<string, RawCandidate[]>();
  for (const candidate of groupedRaw) {
    const key = `${candidate.rule.id}:${candidate.triggerKind}:${candidate.triggerDateIso}`;
    const bucket = groupedBuckets.get(key) ?? [];
    bucket.push(candidate);
    groupedBuckets.set(key, bucket);
  }

  for (const bucket of groupedBuckets.values()) {
    const [{ rule, triggerDateIso }] = bucket;
    const remaining = bucket.filter(
      (candidate) => !claimed.has(`${candidate.expense.id}:${candidate.triggerDateIso}`)
    );
    if (remaining.length === 0) {
      continue;
    }
    const expenses = remaining.map((candidate) => candidate.expense);
    const { title, body } = groupedContent(rule, expenses);
    candidates.push({
      identifier: `rule:${rule.id}:grouped:${triggerDateIso}`,
      ruleId: rule.id,
      triggerKind: "grouped",
      triggerDateIso,
      title,
      body,
      expenseIds: expenses.map((expense) => expense.id),
    });
  }

  return candidates;
}

export interface NotificationLogKey {
  expenseId: string;
  ruleId: string;
  triggerKind: NotificationTriggerKind;
}

function logKey(expenseId: string, ruleId: string, triggerKind: NotificationTriggerKind): string {
  return `${expenseId}:${ruleId}:${triggerKind}`;
}

/**
 * Drops candidates already delivered via any channel (research.md #3): the
 * server-side evaluator (supabase/functions/evaluate-reminders) uses this to
 * avoid re-sending a push for a reminder the local scheduler already
 * delivered, and vice versa. `existingLog` entries are channel-agnostic on
 * purpose — only (expense_id, rule_id, trigger_kind) is compared, matching
 * notifications_log's existing columns; the caller supplies rows regardless
 * of their `channel` value.
 *
 * A grouped candidate is dropped only when every one of its expenseIds has
 * already been delivered — a partially-delivered digest still sends (a
 * small amount of redundant content for already-notified expenses is
 * preferable to silently dropping the reminder for the new ones; FR-004's
 * "no duplicate delivery" concerns per-expense/rule/trigger identity, not
 * digest bundling).
 */
export function filterUndelivered(
  candidates: NotificationCandidate[],
  existingLog: NotificationLogKey[]
): NotificationCandidate[] {
  const delivered = new Set(
    existingLog.map((entry) => logKey(entry.expenseId, entry.ruleId, entry.triggerKind))
  );

  return candidates.filter((candidate) =>
    candidate.expenseIds.some(
      (expenseId) => !delivered.has(logKey(expenseId, candidate.ruleId, candidate.triggerKind))
    )
  );
}
