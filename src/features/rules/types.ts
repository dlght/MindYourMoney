export interface Rule {
  id: string;
  user_id: string;
  name: string;
  enabled: boolean;
  is_default: boolean;
  // Whether matching expenses on the same trigger date are combined into
  // one digest notification (true only for the seeded "Due tomorrow" rule
  // in MVP1 — the rule editor does not expose this as a user-settable
  // field; see research.md and defaultRules.ts).
  is_grouped: boolean;
  min_amount: number | null;
  category_ids: string[] | null;
  days_before: number;
  repeat_days_before: number | null;
  created_at: string;
}

export interface CreateRuleInput {
  name: string;
  min_amount?: number | null;
  category_ids?: string[] | null;
  days_before: number;
  repeat_days_before?: number | null;
}

export interface UpdateRuleInput {
  id: string;
  name?: string;
  enabled?: boolean;
  min_amount?: number | null;
  category_ids?: string[] | null;
  days_before?: number;
  repeat_days_before?: number | null;
}

export type NotificationTriggerKind = "primary" | "repeat" | "grouped";

export interface NotificationLogEntry {
  id: string;
  user_id: string;
  expense_id: string | null;
  rule_id: string | null;
  trigger_kind: NotificationTriggerKind;
  sent_at: string;
  channel: string;
}

// In-memory only (research.md #2/#3) — never persisted directly; drives the
// expo-notifications schedule/cancel calls and the notifications_log insert.
export interface NotificationCandidate {
  identifier: string;
  ruleId: string;
  triggerKind: NotificationTriggerKind;
  triggerDateIso: string;
  title: string;
  body: string;
  // The expense(s) this candidate is about — a single id for per-expense
  // reminders, several for the grouped "due tomorrow" digest.
  expenseIds: string[];
}
