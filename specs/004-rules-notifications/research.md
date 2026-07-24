# Phase 0 Research: Rules & Local Notifications

## 1. Local notification library

**Decision**: Use `expo-notifications` for scheduling, listing, and cancelling
on-device notifications, plus `expo-device`-free permission handling via
`expo-notifications`' own `requestPermissionsAsync`/`getPermissionsAsync`.

**Rationale**: It's the standard Expo-ecosystem local scheduling API, free,
requires no paid service (push tokens/server delivery are explicitly out of
scope — that's F5), and exposes `getAllScheduledNotificationsAsync()`, which
lets the OS itself be the source of truth for "what's currently scheduled" —
avoiding a second, hand-rolled persistence layer for schedule state.

**Alternatives considered**: `notifee` (richer Android channel control, but
an extra native dependency with no MVP1 benefit over `expo-notifications`
for simple scheduled reminders); a server-side cron-based approach (rejected
— that's explicitly the F5 server-push feature, not this one).

## 2. Reconciliation strategy: pure diff against OS-reported schedule

**Decision**: Split the work into (a) a pure, fully unit-testable function
`computeDesiredNotifications(rules, expenses, todayIso)` that returns the
full set of `{identifier, content, triggerDate}` entries that *should* exist
right now, and (b) a thin adapter that calls
`Notifications.getAllScheduledNotificationsAsync()`, diffs by `identifier`,
cancels anything scheduled-but-not-desired, and schedules anything
desired-but-not-scheduled (re-schedules, i.e. cancel+recreate, if an
existing identifier's trigger date or content differs from desired).

**Rationale**: Mirrors the pattern already established for
`dashboard/selectors.ts` (pure functions, thin screen wiring) and for
`recurrence.ts` (pure date math). It means the entire rule-matching,
threshold, dedupe, and grouping logic can be tested with plain objects, with
no OS/notification mocking needed beyond a simple in-memory fake for the two
or three adapter-level tests that need it. Using the OS's own scheduled-list
as the source of truth (rather than a hand-rolled "what did we last
schedule" table) also means the state can never drift out of sync with what
will actually fire.

**Alternatives considered**: Persisting "last scheduled state" in a local
table/AsyncStorage key and diffing against that — rejected because it can
drift from the OS's actual state (e.g. after an app reinstall, OS restart,
or a crash mid-write) in a way `getAllScheduledNotificationsAsync()` cannot.

## 3. Deterministic notification identifiers

**Decision**: Identifiers are deterministic strings so the same logical
reminder always maps to the same identifier across reconciliation passes:
`expense:{expense_id}:rule:{rule_id}:{trigger_kind}` for per-expense
reminders (`trigger_kind` is `"primary"` or `"repeat"`), and
`rule:{rule_id}:grouped:{isoDate}` for a grouped digest (User Story 2) —
which rule produces a grouped-vs-per-expense candidate is itself a stored
attribute (`rules.is_grouped`, added during implementation once the need
for an explicit distinction became concrete — see data-model.md), true
only for the seeded "Due tomorrow" rule and not user-editable.

**Rationale**: Deterministic IDs are what make the diff in Decision #2
possible — the adapter can recognize "this is the same reminder as last
time" without a lookup table. It also directly implements dedupe (FR-011):
if two enabled rules would otherwise produce two entries for the same
expense/due-date, `computeDesiredNotifications` collapses them to one
before the identifier is even assigned (see Decision #5).

**Alternatives considered**: Random/UUID identifiers with a separate
mapping table to remember "which expense/rule this maps to" — strictly more
moving parts for no benefit, since we control ID generation entirely.

## 4. Dedupe across overlapping rules (FR-011, Edge Cases)

**Decision**: `computeDesiredNotifications` groups candidate reminders by
`(expense_id, dueDateIso)` after evaluating all enabled rules, and keeps
only one entry per group — preferring the "Big expense ahead"-style
per-expense reminder over the grouped "Due tomorrow" digest when both would
fire the same day for the same expense (so the more specific, higher-signal
reminder wins and the expense is still folded out of that day's grouped
digest to avoid a redundant second ping).

**Rationale**: Directly satisfies Acceptance Scenario 2 of User Story 2
("the user receives one 'due tomorrow' notification and does not receive a
duplicate reminder... from the big-expense rule's 1-day-before trigger" —
read together with FR-011, the reverse must also hold: no double-send in
either direction).

**Alternatives considered**: Sending both and relying on the user to ignore
duplicates — explicitly rejected by FR-011 and Edge Cases.

## 5. Rule persistence & RLS

**Decision**: New `rules` table, structurally: `id, user_id, name, enabled,
is_default, min_amount numeric(12,2) null, category_ids uuid[] null,
days_before int, repeat_days_before int null, created_at`. RLS policies
mirror `expenses`/`categories` exactly (select/insert/update/delete scoped
to `auth.uid() = user_id`).

**Rationale**: `min_amount`/`category_ids` nullable directly encode "any
amount"/"all categories" per the product's rule schema (§3). Matches
Constitution II (RLS on every table) and the existing migration style.

**Alternatives considered**: A generic JSON `conditions` column for
future-proofing the "full rule builder" (MVP2) — rejected per Constitution
IX/YAGNI; MVP2's multi-condition builder is a separate future feature and
this schema can be migrated then.

## 6. Notification audit trail

**Decision**: New `notifications_log` table: `id, user_id, expense_id,
rule_id, trigger_kind, sent_at, channel default 'push'`. A row is inserted
at the moment the app successfully hands a schedule request to the OS
(i.e., "sent" is approximated as "successfully scheduled for local
delivery"), not on a true OS delivery-confirmation callback.

**Rationale**: `expo-notifications` cannot reliably report delivery
confirmation for a local notification once the app process is fully closed
(the receipt listener only fires while the JS runtime is alive). Since
local notifications, once scheduled, reliably fire via the OS unless
explicitly cancelled by our own reconciliation, "successfully scheduled" is
a deterministic, testable proxy for "sent" that satisfies FR-012's audit
intent without depending on OS behavior we can't observe. This refines the
spec's Assumptions bullet ("recorded once observed as delivered... or next
app open") into a concrete, implementable rule: log at schedule-time,
cancel-aware (a log entry is not retroactively deleted if later cancelled —
it's a historical record of what was scheduled, not a live schedule state).
A true delivery-confirmed log is deferred to F5 (server push), where the
Edge Function can log at actual send time server-side.

**Alternatives considered**: Only logging on
`addNotificationReceivedListener` — rejected as unreliable/incomplete for
notifications delivered while the app is fully closed, which is the common
case for a "5 days before" reminder.

## 7. Reconciliation triggers

**Decision**: Reconciliation (recompute + diff + apply) runs: (a) after
every expense create/update/delete/mark-paid mutation succeeds, (b) after
every rule create/update/delete/toggle mutation succeeds, and (c) whenever
`AppState` transitions to `'active'` (app foregrounded), mounted once at the
tabs root layout.

**Rationale**: (a) and (b) satisfy Constitution V directly ("every mutation
... MUST reconcile ... as part of the same operation"). (c) covers the
documented architecture limitation that "rules re-evaluate only when the
app opens" (product doc §4) — e.g. a trigger date passing while the app was
closed, or state changed by a rolled-forward recurring expense between
sessions.

**Alternatives considered**: Reconciling only on mutation (skip AppState
listener) — rejected because a reminder whose trigger date silently passed
while the app was closed for days would never be cancelled/corrected until
some unrelated mutation happened to run.

## 8. Money comparisons (Constitution VI)

**Decision**: Extract the existing `toCents()` helper out of
`src/features/dashboard/selectors.ts` into a shared `src/lib/money.ts`
(re-exported from the dashboard module for backward compatibility within
that module), and use it in `notificationEngine.ts` for the
`amount >= min_amount` threshold comparison.

**Rationale**: Avoids duplicating the same integer-cents conversion in two
feature modules; keeps the single-source-of-truth principle from
Constitution VI. Low-risk, mechanical extraction (no behavior change to
the dashboard).

**Alternatives considered**: Duplicating a small local `toCents` inside
`notificationEngine.ts` — rejected as an unnecessary near-duplicate once a
shared `src/lib/` already exists for cross-feature utilities.

## 9. Permission handling (FR-014)

**Decision**: Request notification permission the first time the Rules
screen is opened (or lazily on first reconciliation attempt). If denied,
`RulesScreen` shows a dismissible banner: "Reminders are off — enable
notifications in your device settings to get expense alerts." Expense/rule
CRUD and all other app functionality remain fully usable regardless of
permission state; reconciliation simply skips the actual
`scheduleNotificationAsync` OS call (and does not write a
`notifications_log` row, since Decision #6 defines "sent" as "successfully
scheduled") when permission is not granted.

**Rationale**: Matches FR-014 exactly and the existing pattern of
graceful-degradation-over-blocking established in F2 (e.g. offline-tolerant
reads, inline error states rather than blocking dialogs).

**Alternatives considered**: Blocking rule creation until permission is
granted — rejected; unnecessarily punitive and contrary to Constitution IV
(offline/degraded-mode tolerance as a default posture).
