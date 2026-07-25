# Contract: Default Rule Set & Backfill Behavior

Defines the concrete, checkable rule FR-006/FR-007/FR-008/FR-009/FR-010/
FR-011/FR-012 require for `src/features/rules/seedRules.ts` and
`src/features/rules/defaultRules.ts`.

## Rule

1. `DEFAULT_RULES` (`defaultRules.ts`) MUST contain exactly three entries
   after this change: the existing `"Big expense ahead"` and
   `"Due tomorrow"` (byte-for-byte unchanged — FR-010), plus a new
   `"Due today"` entry with `days_before: 0`, `min_amount: null`,
   `is_grouped: true`, `repeat_days_before: null` (data-model.md).
2. `seedRules(userId)` MUST, on every invocation:
   - Fetch the caller's existing rule `name`s (one query, same round-trip
     budget as today's existence check).
   - Insert exactly the `DEFAULT_RULES` entries whose `name` is **not**
     already present among the user's existing rules — regardless of
     whether an existing same-named row is `enabled: true` or `enabled:
     false` (a disabled row still counts as "present" and MUST NOT be
     re-inserted or re-enabled — FR-009).
   - Insert nothing when all three default names are already present
     (steady-state no-op, same as today for a fully-seeded user).
   - Remain a single batched insert call when there is anything to insert
     (no per-row round-trips).
3. A brand-new user (zero existing rules) MUST end up with all three default
   rules, `enabled: true`, after their first `seedRules` call (FR-007).
4. Notification delivery for the new rule MUST flow through the existing,
   unmodified `computeDesiredNotifications` / `filterUndelivered` /
   `notifications_log` dedup path (research.md #4) — no new dedup mechanism
   (FR-012).

## Non-goals

- No SQL migration or DB-level backfill (research.md #2) — client-side
  seeding only, matching migration 0003's documented convention.
- No change to `rulesApi.ts`'s `deleteRule` default-rule protection, or to
  the rule editor UI — the new rule is edited/disabled exactly like the two
  existing defaults, through existing UI.
- No change to `computeDesiredNotifications`, `notificationScheduler.ts`, or
  the `evaluate-reminders` Edge Function — `days_before: 0` is already
  handled generically by all three (research.md #4).

## Verification

SC-003 (20/20 due-today expenses across untouched-default-rule users
produce a reminder regardless of amount), SC-004 (100% of new accounts end
up with 3 enabled default rules), and SC-005 (0 already-disabled default
rules get silently re-enabled) are checked via:
- Unit tests on `seedRules`'s name-diffing logic against fixtures for: zero
  existing rules, all-three-already-present, exactly-the-two-old-defaults-
  present (the real-world "existing user" case), and one-default-disabled.
- Unit tests on `computeDesiredNotifications` with a `days_before: 0` rule
  fixture and an expense due "today," asserting a candidate is produced
  regardless of the expense's `amount`.
- Manual/quickstart validation against a real Supabase test account seeded
  before this change ships (simulating a genuine existing user).
