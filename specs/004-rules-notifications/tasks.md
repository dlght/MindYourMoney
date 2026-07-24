---

description: "Task list template for feature implementation"
---

# Tasks: Rules & Local Notifications

**Input**: Design documents from `/specs/004-rules-notifications/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/rules-schema.sql, quickstart.md

**Tests**: Included — Constitution VIII mandates unit tests for the rule/notification engine and component tests for screens; Constitution V mandates the reconciliation logic specifically be covered by tests.

**Organization**: Tasks are grouped by user story (US1 = P1, US2 = P2, US3 = P3) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Add `expo-notifications` to `package.json` dependencies and register it (with default icon/color config) under `plugins` in `app.json`
- [X] T002 [P] Extract `toCents` from `src/features/dashboard/selectors.ts` into new `src/lib/money.ts`; update `selectors.ts` to import and re-export it (no behavior change; research.md #8)
- [X] T003 [P] Copy `specs/004-rules-notifications/contracts/rules-schema.sql` to `supabase/migrations/0003_rules_notifications.sql` and apply it to the Supabase project (creates `rules` and `notifications_log` tables + RLS)

**Checkpoint**: Dependencies installed, shared money helper extracted, schema applied.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Rule data model + read/write access that every user story depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Create `src/features/rules/types.ts` — `Rule`, `NotificationLogEntry`, `NotificationCandidate` types (data-model.md)
- [X] T005 [P] Create `src/features/rules/defaultRules.ts` — the two seeded rule definitions ("Big expense ahead": min_amount 200, days_before 5, repeat_days_before 1; "Due tomorrow": min_amount null, days_before 1), mirroring `defaultCategories.ts`'s shape
- [X] T006 Create `src/features/rules/seedRules.ts` — idempotent per-user seed (checks existing rows before inserting), mirroring `seedCategories.ts` exactly (tests/unit/seedCategories.test.ts pattern)
- [X] T007 Wire `seedRules(userId)` into `src/features/auth/AuthProvider.tsx`'s `SIGNED_IN` handler, alongside the existing `seedCategories` call, as a fire-and-forget idempotent call
- [X] T008 Create `src/features/rules/rulesApi.ts` — Supabase CRUD (list, create, update, delete) scoped to the signed-in user; `delete` MUST reject when `is_default = true` (FR-005), mirroring `expensesApi.ts`'s structure
- [X] T009 Create `src/features/rules/useRules.ts` — TanStack Query hook (offline-tolerant cache, shared query key), mirroring `useExpenses.ts`

**Checkpoint**: Rules can be seeded, read, and persisted — user story implementation can now begin.

---

## Phase 3: User Story 1 - Get warned before a big expense hits (Priority: P1) 🎯 MVP

**Goal**: An enabled "Big expense ahead"-style rule automatically produces correctly-timed, correctly-cancelled local reminders as expenses are added, edited, paid, or deleted.

**Independent Test**: Create a €250 expense due in 10 days with no other setup; confirm a reminder is scheduled for 5 days before, a second for 1 day before if still unpaid, and both cancel if the expense is paid or edited below €200 first.

### Tests for User Story 1 ⚠️

- [X] T010 [P] [US1] Write `tests/unit/notificationEngine.test.ts` covering: threshold match/no-match, primary + repeat trigger date computation, skip-if-trigger-already-passed (FR-009), cancel-on-paid/edited-below-threshold candidate sets — written first, expected to fail (no implementation yet)

### Implementation for User Story 1

- [X] T011 [US1] Implement `src/features/rules/notificationEngine.ts`'s `computeDesiredNotifications(rules, expenses, todayIso)` pure function to satisfy T010 (research.md #2/#3/#8; uses `src/lib/money.ts`'s `toCents` for the `amount >= min_amount` comparison)
- [X] T012 [US1] Implement `src/features/rules/notificationScheduler.ts` — adapter calling `Notifications.getAllScheduledNotificationsAsync()`, diffing by identifier against `computeDesiredNotifications`'s output, cancelling stale/scheduling missing, and inserting a `notifications_log` row at successful schedule time (research.md #6)
- [X] T013 [US1] Implement `src/features/rules/useNotificationReconciliation.ts` exposing a `reconcile()` callback that loads current rules + planned expenses and calls the scheduler
- [X] T014 [US1] Wire `reconcile()` into `src/features/expenses/useExpenseMutations.ts`'s create/update/delete/mark-paid mutations (`onSuccess`), satisfying Constitution V's "same operation, not a follow-up step"
- [X] T015 [US1] Add notification permission request/check (`Notifications.requestPermissionsAsync`) inside `notificationScheduler.ts`; skip OS scheduling and the `notifications_log` insert (but never throw) when permission is not granted (FR-014, research.md #9)

**Checkpoint**: User Story 1 fully functional — big-expense reminders schedule and reconcile correctly in isolation.

---

## Phase 4: User Story 2 - Get a quiet heads-up for anything due tomorrow (Priority: P2)

**Goal**: Expenses due tomorrow (any amount) produce exactly one grouped digest notification, deduped against any overlapping per-expense reminder from another rule.

**Independent Test**: Create two expenses due tomorrow (one below, one above the big-expense threshold); confirm exactly one grouped notification is scheduled and the big-expense rule does not also fire separately for the overlapping one.

### Tests for User Story 2 ⚠️

- [X] T016 [P] [US2] Extend `tests/unit/notificationEngine.test.ts` with: grouped "due tomorrow" digest content (multiple expenses in one notification), and cross-rule dedupe when a "due tomorrow" candidate and a "big expense" candidate would otherwise both fire the same expense/date (FR-011) — written first, expected to fail

### Implementation for User Story 2

- [X] T017 [US2] Extend `computeDesiredNotifications` in `notificationEngine.ts` to produce the `due-tomorrow:{isoDate}` grouped candidate (research.md #3) and apply the dedupe-by-`(expense_id, dueDateIso)` rule (research.md #4) to satisfy T016

**Checkpoint**: User Stories 1 AND 2 both work independently — default rules fully deliver the MVP notification promise.

---

## Phase 5: User Story 3 - Customize or add reminder rules (Priority: P3)

**Goal**: Users can view, edit, disable, create, and delete (non-default) rules through a dedicated screen, with every change reconciling notifications immediately.

**Independent Test**: Edit the seeded "Big expense ahead" rule's threshold from €200 to €500 and confirm an existing €300 expense's scheduled reminder is cancelled without touching the expense directly.

### Tests for User Story 3 ⚠️

- [X] T018 [P] [US3] Write `tests/component/rules-screen.test.tsx` covering: default rules listed on first view (Scenario 1), edit-a-rule reconciles (Scenario 6), disable-a-rule cancels its notifications (Scenario 7), delete blocked for default rules with a disable offer instead (Scenario 8), custom rule create/delete (Scenario 9), and the permission-off banner (Scenario 11) — written first, expected to fail

### Implementation for User Story 3

- [X] T019 [US3] Create `src/features/rules/useRuleMutations.ts` — create/update/delete/toggle-enabled mutations via `rulesApi.ts`, each calling `reconcile()` from `useNotificationReconciliation.ts` in `onSuccess` (Constitution V)
- [X] T020 [US3] Implement `src/features/rules/RuleSheet.tsx` — create/edit bottom sheet (name, amount threshold or "any amount", days-before, optional repeat days-before, optional category filter, enabled toggle), reusing `@gorhom/bottom-sheet` and the compact category-picker pattern from `ExpenseSheet.tsx`/`CategoryPicker.tsx`
- [X] T021 [US3] Implement `src/features/rules/RulesScreen.tsx` — lists rules (default vs. custom), opens `RuleSheet` for create/edit, exposes disable toggle, blocks delete for `is_default` rules (showing a disable-instead prompt), and shows the permission-off banner when notification permission is denied
- [X] T022 [US3] Replace the F1 placeholder in `app/(tabs)/rules.tsx` with `RulesScreen`, wired to `useRules()` and `useRuleMutations()`, to satisfy T018

**Checkpoint**: All three user stories independently functional — full rule management available.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T023 Mount an `AppState` `'active'`-transition listener once (in `app/(tabs)/_layout.tsx`) that calls `reconcile()` on foreground, per research.md #7(c)/FR-008
- [X] T024 Run full `npx jest` suite and `npx tsc --noEmit`; fix any regressions surfaced by the extraction in T002 or the new `rules` module
- [ ] T025 Run `quickstart.md` Scenarios 1-12 manually on-device/simulator (left unchecked here for the user to perform, per F2/F3 precedent — device-level notification permission prompts and scheduled-notification timing can't be fully exercised by Jest)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup (needs the applied schema from T003) — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational only
- **User Story 2 (Phase 4)**: Depends on Foundational; extends the same `notificationEngine.ts` file US1 creates, so it runs after Phase 3 in this solo-iteration plan even though it is conceptually independent
- **User Story 3 (Phase 5)**: Depends on Foundational; independent of US1/US2's engine internals (only needs `useRules`/`rulesApi` from Phase 2 plus `reconcile()` from Phase 3's T013)
- **Polish (Phase 6)**: Depends on all three user stories being complete

### Parallel Opportunities

- T002 and T003 (Setup) can run in parallel with each other and with T001
- T005 (Foundational) can run in parallel with T004
- T010 (US1 tests) and T016 (US2 tests) touch the same test file sequentially in this plan (T016 extends T010's file) — not parallel with each other, but T010 can start as soon as Phase 2 is done
- T018 (US3 tests) is a separate file from T010/T016 and can run in parallel with Phase 3/4's test-writing

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Big-expense reminders schedule/cancel correctly in isolation (quickstart Scenarios 1-4)
5. Continue to US2 → US3 → Polish incrementally, each independently testable per quickstart.md
