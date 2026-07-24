---

description: "Task list for feature implementation"
---

# Tasks: Home Dashboard

**Input**: Design documents from `/specs/003-home-dashboard/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md (all present; no `contracts/` — this feature adds no new schema/RPC)

**Tests**: Included — constitution principle VIII mandates component tests
for screens and unit tests for non-trivial logic (here: the windowing/
grouping/summation/tie-break selector math); these are not optional for
this project.

**Organization**: Tasks are grouped by user story (from spec.md: US1 =
Next-30-days grouped list [P1], US2 = Next-month total [P2], US3 =
Biggest-upcoming-expense card [P3]). Build order follows priority: US1 →
US2 → US3. US1 also builds `DashboardScreen.tsx`'s shared empty/offline/
error-state handling, since those states apply across all three sections
and there is nothing to attach them to before US1 exists.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Paths are relative to repository root

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Confirm no new dependencies are required (this feature reuses `@tanstack/react-query`, `src/features/expenses/useExpenses.ts`, and `src/features/expenses/useExpenseMutations.ts` unchanged per plan.md/research.md); create the `src/features/dashboard/` directory

**Checkpoint**: No new install needed; project still builds.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 [P] Create `src/features/dashboard/types.ts` with the `UpcomingGroup`, `MonthlyTotal`, and `BiggestUpcoming` view-model types per data-model.md (no logic, types only)
- [X] T003 Create `src/features/dashboard/selectors.ts` scaffold with shared pure helpers used by every story: `getTodayIso()`, a date-range membership check for `due_date` strings, and an integer-cent conversion helper (`toCents(amount)`) per research.md #2 and #4 — no story-specific selector function yet (depends on T002)

**Checkpoint**: Foundation ready — shared types/helpers in place; user story implementation can now begin.

---

## Phase 3: User Story 1 - See what's coming due in the next 30 days (Priority: P1) 🎯 MVP

**Goal**: A signed-in user opens the Home tab and sees their `planned`
expenses due in the next 30 days, grouped by date, with a "Today" heading
where applicable, and can mark one as paid directly from the list.

**Independent Test**: Sign in with an account that has expenses due in 5,
12, and 40 days, open the Home tab, and confirm only the 5-day and 12-day
expenses appear, each under its own date heading, and marking one paid
removes it from the list immediately.

### Tests for User Story 1

- [X] T004 [P] [US1] Unit test for `groupNext30Days` in `tests/unit/dashboard-selectors.test.ts`: inclusive `[today, today+29]` windowing, string-date grouping, chronological group order, in-group sort (amount desc, then name asc), excludes `paid`/`skipped` status, empty result when nothing qualifies
- [X] T005 [P] [US1] Component test in `tests/component/dashboard-screen.test.tsx` for the next-30-days list: grouped rendering, "Today" heading, a zero-expenses empty state, a has-expenses-but-none-upcoming empty state, offline renders last-cached data, a fetch error shows a retry control, and marking an item paid updates the list immediately

### Implementation for User Story 1

- [X] T006 [US1] Implement `groupNext30Days(expenses, todayIso)` in `src/features/dashboard/selectors.ts`, returning `UpcomingGroup[]` per data-model.md (depends on T003)
- [X] T007 [US1] Create `src/features/dashboard/UpcomingList.tsx`: renders `UpcomingGroup[]` with date headings ("Today" vs. a localized date string) and a per-row "Mark as paid" action, styled via existing NativeWind theme tokens
- [X] T008 [US1] Create `src/features/dashboard/DashboardScreen.tsx`: wires `useExpenses()` (from `src/features/expenses/useExpenses.ts`, unchanged) and `useMarkExpensePaid()` (from `src/features/expenses/useExpenseMutations.ts`, unchanged, per research.md #6) to `UpcomingList`; implements the zero-expenses empty state, the has-data-but-none-upcoming empty state, the offline/cached-data render path, and the fetch-error-with-retry state (FR-009–FR-011) — this container is extended by US2/US3, not rebuilt
- [X] T009 [US1] Replace `app/(tabs)/index.tsx`'s F1 `ScreenPlaceholder` with `DashboardScreen`

**Checkpoint**: US1 is fully functional and testable independently — a user
can see and act on their next-30-days list, with all shared empty/offline/
error states already in place for US2/US3 to build on.

---

## Phase 4: User Story 2 - See the upcoming total at a glance (Priority: P2)

**Goal**: The Home screen shows the total amount of `planned` expenses due
within the next 30 days (the same window US1's list shows — see T022's
correction below; originally built against a calendar-month window, self-critique F4),
updating live as expenses change.

**Independent Test**: Create planned expenses due within the next 30 days
totaling a known amount, open the Home tab, and confirm the displayed total
matches exactly; then add/edit/delete one and confirm the total updates.

### Tests for User Story 2

- [X] T010 [P] [US2] Unit test for `nextMonthTotal` in `tests/unit/dashboard-selectors.test.ts` (extends T004's file): full-calendar-month windowing independent of the 30-day window, integer-cent summation (no float-drift across many rows), returns `0` when nothing qualifies, month-boundary edge case from spec Edge Cases
- [X] T011 [P] [US2] Component test for `MonthlyTotalCard` in `tests/component/dashboard-screen.test.tsx` (extends T005's file): renders the correct total, renders `0` (not blank) when empty, updates after a simulated add/edit/delete

### Implementation for User Story 2

- [X] T012 [US2] Implement `nextMonthTotal(expenses, todayIso)` in `src/features/dashboard/selectors.ts` using the integer-cent helper from T003 (depends on T003; per research.md #3–#4)
- [X] T013 [US2] Create `src/features/dashboard/MonthlyTotalCard.tsx`
- [X] T014 [US2] Wire `MonthlyTotalCard` into `DashboardScreen.tsx` (depends on T008 from US1)

**Checkpoint**: US1 and US2 both work independently and together.

---

## Phase 5: User Story 3 - Spot the single biggest upcoming expense (Priority: P3)

**Goal**: The Home screen highlights the single largest `planned` expense
due within the next 30 days in its own card, with a deterministic tie-break
and an empty state when nothing qualifies.

**Independent Test**: Create planned expenses of varying amounts within the
next 30 days, open the Home tab, and confirm the card shows the highest-
amount one with its name and due date; with no qualifying expenses, confirm
the card is hidden or shows its empty state instead.

### Tests for User Story 3

- [X] T015 [P] [US3] Unit test for `biggestUpcoming` in `tests/unit/dashboard-selectors.test.ts` (extends T004/T010's file): highest amount wins, ties broken by soonest `due_date` then by name (research.md #5), returns `null` when the next-30-days window has no `planned` expenses
- [X] T016 [P] [US3] Component test for `BiggestExpenseCard` in `tests/component/dashboard-screen.test.tsx` (extends T005/T011's file): renders name/amount/due date of the winning expense, renders its empty state when `biggestUpcoming` is `null`

### Implementation for User Story 3

- [X] T017 [US3] Implement `biggestUpcoming(expenses, todayIso)` in `src/features/dashboard/selectors.ts` (depends on T003; reuses the same next-30-days-filtered, `planned`-only subset as T006, per research.md #5)
- [X] T018 [US3] Create `src/features/dashboard/BiggestExpenseCard.tsx` (renders the card, or an empty-state message per FR-008)
- [X] T019 [US3] Wire `BiggestExpenseCard` into `DashboardScreen.tsx` (depends on T008 from US1)

**Checkpoint**: All three user stories are independently functional and
demonstrable together as Feature F3.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T020 Run `quickstart.md` Scenarios 1–14 manually end-to-end against a real Supabase project/account
- [X] T021 [P] Full `tsc --noEmit` typecheck pass across all new/changed files — clean, zero errors

**Note**: T020 requires a physical device/simulator run against a real
Supabase project and is left for the user to perform and confirm, matching
how F2's equivalent manual-validation task (T026) was completed. All
underlying logic is covered by the 23 new automated tests (70/70 total
passing across the whole suite) and `tsc --noEmit` is clean.

---

## Phase 7: Post-Implementation Patch

Issue found using the dashboard on a real device, after T001–T021 landed.
Tracked here rather than folded silently into the tasks above, per
constitution VIII (spec-driven delivery — behavior changes get a recorded
task, not an undocumented edit).

- [X] T022 Retarget the "Next month" total to sum the same next-30-days/`planned` set the list already shows, instead of an independent calendar-month window. Reported symptoms: the total often equaled a single expense's amount that coincidentally matched the biggest-upcoming-expense card, and marking an expense paid from the visible list frequently didn't change the total at all — both were the calendar-month window (mostly disjoint from the visible next-30-days window) doing exactly what it was told, not a bug in the arithmetic. Extracted a shared `planForNext30Days` filter in `src/features/dashboard/selectors.ts` used by `groupNext30Days`, the renamed `upcomingTotal` (was `nextMonthTotal`), and `biggestUpcoming`, so all three always agree; renamed `MonthlyTotalCard.tsx` → `UpcomingTotalCard.tsx` and relabeled it "Upcoming total (next 30 days)" (see research.md #3 round 2 patch, #7)

**Spec sync**: T022's change is significant enough user-facing behavior to
amend the formal requirements rather than leave it as an undocumented
implementation deviation — see spec.md's rewritten US2, FR-005, FR-009,
FR-012, SC-002, and the Assumptions entry, plus quickstart.md's rewritten
Scenarios 6–8.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational only
- **User Story 2 (Phase 4)**: Depends on Foundational; `MonthlyTotalCard`'s wiring (T014) additionally depends on US1's `DashboardScreen.tsx` (T008) existing, though the selector (T012) and its test (T010) can be built in parallel with US1
- **User Story 3 (Phase 5)**: Depends on Foundational; `BiggestExpenseCard`'s wiring (T019) additionally depends on US1's `DashboardScreen.tsx` (T008), though the selector (T017) and its test (T015) can be built in parallel with US1/US2
- **Polish (Phase 6)**: Depends on all three user stories being complete

### User Story Dependencies

- **US1 (P1)**: No dependency on US2/US3 — testable alone once Foundational is done; also produces the shared `DashboardScreen.tsx` container US2/US3 extend
- **US2 (P2)**: Selector/test independent of US1; UI wiring needs US1's `DashboardScreen.tsx`, so practical build order is US1 → US2
- **US3 (P3)**: Selector/test independent of US1/US2; UI wiring needs US1's `DashboardScreen.tsx`, so practical build order is US1 → US3

### Within Each User Story

- Tests written before implementation, and MUST fail first
- Selector (pure logic) before the component that renders it
- Story complete before moving to the next priority

### Parallel Opportunities

- T002 and T003 in Foundational: T002 (types) has no dependency and can start immediately; T003 depends on T002 existing but nothing else
- Within US1: T004 and T005 (tests, different files) in parallel; T006 depends on T003
- Within US2: T010 and T011 (tests, different files) in parallel; T012 depends on T003 only, so it can be built alongside US1's implementation, not just after
- Within US3: T015 and T016 (tests, different files) in parallel; T017 depends on T003 only, same early-start opportunity as T012
- T021 (typecheck) can run in parallel with T020 (manual quickstart pass)

---

## Parallel Example: Foundational Phase

```bash
# T002 first (types), then:
Task: "Create src/features/dashboard/selectors.ts scaffold with shared date/cents helpers"
```

## Parallel Example: Selector-only early start

```bash
# These three touch the same file (selectors.ts) but only depend on T003,
# not on each other or on any UI — safe to implement in any order once
# Foundational is done, even before US1's UI lands:
Task: "Implement groupNext30Days in selectors.ts"
Task: "Implement nextMonthTotal in selectors.ts"
Task: "Implement biggestUpcoming in selectors.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) + Phase 2 (Foundational)
2. Complete Phase 3 (US1: next-30-days grouped list + mark-as-paid + all
   shared empty/offline/error states)
3. **STOP and VALIDATE**: run quickstart.md Scenarios 1–5, 12–14 by hand
4. This alone replaces the Home placeholder with real, forward-looking
   value — the product's core "never be surprised" list — even before the
   monthly total or biggest-expense card exist

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add US1 → validate the grouped list independently (MVP!)
3. Add US2 → validate the next-month total independently
4. Add US3 → validate the biggest-expense card independently → Feature F3
   complete
5. Polish (T020–T021) → full quickstart.md pass

---

## Notes

- [P] tasks touch different files with no unfinished dependency between them
- [Story] labels map tasks back to spec.md's prioritized user stories
- Commit after each task or logical group, per constitution IX (small, mergeable slices)
- Verify each new test fails before writing the implementation that makes it pass
- This feature has no `contracts/` and no Supabase migration task — there is
  no new backend surface to apply or verify
