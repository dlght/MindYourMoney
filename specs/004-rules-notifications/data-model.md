# Phase 1 Data Model: Rules & Local Notifications

## Rule (Postgres: `rules` table)

Represents one user-owned reminder configuration.

| Field | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key, `gen_random_uuid()` |
| `user_id` | `uuid` | FK → `auth.users`, RLS scope |
| `name` | `text` | Non-empty; e.g. "Big expense ahead" |
| `enabled` | `boolean` | Default `true` |
| `is_default` | `boolean` | Default `false`; `true` for the two seeded rules — used to block deletion (FR-005) |
| `is_grouped` | `boolean` | Default `false`; `true` only for the seeded "Due tomorrow" rule — same-day matches combine into one digest notification instead of one per expense. Not exposed as an editable field in the rule editor (FR-004 lists only threshold/timing/category/enabled as editable); custom rules created via FR-003 are always `false`. |
| `min_amount` | `numeric(12,2)`, nullable | `null` = any amount; else amount threshold (`amount >= min_amount`) |
| `category_ids` | `uuid[]`, nullable | `null` = all categories; else FK-checked list of `categories.id` |
| `days_before` | `int` | Primary trigger, 0-30 days before `due_date` |
| `repeat_days_before` | `int`, nullable | Optional second, later trigger (e.g. 1-day-before follow-up); must be `< days_before` when present |
| `created_at` | `timestamptz` | Default `now()` |

**Validation rules**:
- `days_before` between 0 and 30 inclusive (matches product rule schema §3).
- `repeat_days_before`, when present, must be `>= 0` and `< days_before`.
- `min_amount`, when present, must be `> 0`.
- Every `category_ids` entry must reference a category owned by the same `user_id` (enforced at the application layer, same pattern as `expenses.category_id`).

**Relationships**: many `Rule` rows per user; a `Rule` has no direct FK to `Expense` — matching happens at evaluation time (Rule conditions vs. each planned Expense), not via a stored join.

## NotificationLogEntry (Postgres: `notifications_log` table)

Represents one reminder the app successfully scheduled for local delivery (see research.md #6 for the "sent" definition).

| Field | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `user_id` | `uuid` | FK → `auth.users`, RLS scope |
| `expense_id` | `uuid`, nullable | FK → `expenses`; nullable only for a hypothetical rule-less/system notification (unused in this feature, kept for schema parity with the original product doc §5) |
| `rule_id` | `uuid`, nullable | FK → `rules`; `on delete set null` so deleting a custom rule doesn't erase history |
| `trigger_kind` | `text` | `'primary'`, `'repeat'`, or `'grouped'` (the due-tomorrow digest) |
| `sent_at` | `timestamptz` | Default `now()`, set when the row is inserted (schedule time) |
| `channel` | `text` | Column default `'push'` (unused after F5); F5 changed the app to write `'local'` (this feature's on-device scheduler) or `'server'` (F5's Edge Function), used to dedupe reminders delivered via either path against each other — self-critique F8 |

**Relationships**: many `NotificationLogEntry` rows per `Expense`/`Rule`; append-only (no updates), read for audit/history display only.

## Expense *(existing, from F2 — referenced, not modified)*

Fields used by rule evaluation: `id`, `user_id`, `category_id`, `amount`, `due_date`, `status` (`'planned'` expenses only are evaluated), `recurrence`.

## Derived (in-memory only, not persisted): NotificationCandidate

Produced by `computeDesiredNotifications` (research.md #2); never written to the database directly — only used to drive the `expo-notifications` schedule/cancel calls and the `notifications_log` insert.

| Field | Notes |
|---|---|
| `identifier` | Deterministic string (research.md #3) |
| `expenseId` | nullable for the grouped digest identifier (research.md #3), present for per-expense reminders |
| `ruleId` | which rule produced this candidate |
| `triggerKind` | `'primary' \| 'repeat' \| 'grouped'` |
| `triggerDateIso` | the calendar date the notification should fire on |
| `title` / `body` | notification content (grouped digest summarizes count + names) |

## State transitions

- A `Rule` moves `enabled: true → false` (or back) via the rule editor's toggle — this alone must trigger reconciliation (FR-007), even with no other field changed.
- A `Rule.is_default = true` row can transition `enabled` and its other editable fields, but never transitions to deleted (enforced at the application layer per FR-005).
- An `Expense` transitioning `planned → paid` (directly or via recurring roll-forward) removes it from rule evaluation going forward, cancelling any of its pending `NotificationCandidate`s (FR-010, FR-015).
