---

description: "Task list for feature implementation"
---

# Tasks: Expense CRUD & Recurrence

**Input**: Design documents from `/specs/002-expense-crud-recurrence/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Included — constitution principle VIII mandates component tests
for screens and unit tests for non-trivial logic (here: recurrence math and
the mark-as-paid roll-forward's idempotency); these are not optional for
this project.

**Organization**: Tasks are grouped by user story (from spec.md: US1 = Log
an expense [P1], US2 = Edit/delete an expense [P2], US3 = Recurring
mark-as-paid roll-forward [P1]). US1 and US3 share priority P1; US1 is
built first because US3's UI (a "Mark as paid" action) has nothing to act
on without an expense already existing, so the practical build order is
US1 → US3 → US2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Paths are relative to repository root

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Install `@gorhom/bottom-sheet` dependency (research.md #3; no other new setup needed — `react-native-gesture-handler`/`react-native-reanimated` already present from F1)

**Checkpoint**: Dependency installed; project still builds.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 Apply `contracts/expenses-schema.sql` as `supabase/migrations/0002_expenses.sql` (`expenses` table + RLS scoped to `auth.uid()` + the `mark_expense_paid` roll-forward function, per data-model.md and research.md #1) against the Supabase project — applied to project `tvbyqwnwlrlsxvgemwls` via the Supabase Management API (`SUPABASE_ACCESS_TOKEN` supplied in local `.env.local`); verified the `expenses` table (13 columns), all 4 RLS policies, RLS enabled, and the `mark_expense_paid` function all exist
- [X] T003 [P] Create `src/features/expenses/types.ts` (the `Expense` TypeScript type matching data-model.md's field list)
- [X] T004 [P] Create `src/features/expenses/recurrence.ts` (`nextOccurrence(dueDate, recurrence)` pure function — monthly/yearly with month-end/leap-day clamping, per research.md #2)
- [X] T005 [P] Create `src/features/expenses/validation.ts` (name non-empty, amount `> 0`, per FR-002)
- [X] T006 Create `src/features/expenses/expensesApi.ts` (Supabase client wiring + `listExpenses`, scoped to the signed-in user; depends on T002)
- [X] T007 Create `src/features/expenses/useExpenses.ts` (TanStack Query hook wrapping `listExpenses`, reusing the `networkMode: 'offlineFirst'` client from F1's `src/lib/queryClient.ts`, per research.md #4)

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 - Log an upcoming expense (Priority: P1) 🎯 MVP

**Goal**: A signed-in user can add an expense (name, amount, due date,
category) and see it in a list.

**Independent Test**: Open the Add tab, enter a name, amount, due date, and
category, save, and confirm the expense now exists with exactly those
values and appears in the list.

### Tests for User Story 1

- [X] T008 [P] [US1] Component test for the expense sheet's add-mode (field validation, non-positive-amount rejection, category defaults to "Other" when unset) in `tests/component/expense-sheet.test.tsx`

### Implementation for User Story 1

- [X] T009 [US1] Extend `expensesApi.ts` with `createExpense` (resolves `category_id` to the user's "Other" category when none is passed, per FR-003; depends on T006)
- [X] T010 [US1] Create `src/features/expenses/useExpenseMutations.ts` with a `useCreateExpense` optimistic mutation (writes the expected row into the `useExpenses` cache in `onMutate`, rolls back `onError`, per research.md #4)
- [X] T011 [US1] Create `src/features/expenses/ExpenseSheet.tsx` add-mode: name/amount/due-date/category/recurrence fields inside a `@gorhom/bottom-sheet`, validated via `validation.ts`, saving via `useCreateExpense`
- [X] T012 [US1] Create `src/features/expenses/ExpenseList.tsx` (a minimal list of the signed-in user's expenses, sourced from `useExpenses` — an interim surface standing in for F3's Home dashboard so added expenses are visible/selectable in this feature)
- [X] T013 [US1] Wire `app/(tabs)/add.tsx` to render `ExpenseList` plus a button that opens `ExpenseSheet` in add-mode (replaces F1's `ScreenPlaceholder`)

**Checkpoint**: A user can add an expense and see it in a list, independent
of edit/delete or recurrence roll-forward existing yet.

---

## Phase 4: User Story 3 - Mark a recurring expense as paid and have it roll forward (Priority: P1)

**Goal**: Marking a monthly/yearly recurring expense paid automatically
creates the next occurrence, exactly once, however many times the action
is retried.

**Independent Test**: Create an expense with monthly recurrence, mark it
paid, and confirm a new expense appears with the same name/amount/category
due one month later, while the original is preserved with status "paid";
repeat the mark-as-paid call and confirm no second occurrence appears.

### Tests for User Story 3

- [X] T014 [P] [US3] Unit test for `recurrence.ts`'s monthly/yearly roll-forward math, including month-end and leap-day clamping, in `tests/unit/recurrence.test.ts`
- [X] T015 [P] [US3] Unit test for `markExpensePaid` idempotency (repeated calls on an already-paid expense produce no second roll-forward; non-recurring expenses never roll forward) in `tests/unit/expensesApi.test.ts`

### Implementation for User Story 3

- [X] T016 [US3] Extend `expensesApi.ts` with `markExpensePaid(id)` calling the `mark_expense_paid` RPC from T002 (depends on T002, T006)
- [X] T017 [US3] Extend `useExpenseMutations.ts` with a `useMarkExpensePaid` mutation (optimistically flips status and previews the next occurrence via `recurrence.ts`, then reconciles with the RPC's actual response)
- [X] T018 [US3] Add a "Mark as paid" action to `ExpenseList.tsx` calling `useMarkExpensePaid` (depends on T012 from US1)

**Checkpoint**: Recurring expenses roll forward correctly and idempotently,
independent of edit/delete existing yet.

---

## Phase 5: User Story 2 - Edit or delete an existing expense (Priority: P2)

**Goal**: A user can change an existing expense's fields or remove it,
with delete requiring confirmation.

**Independent Test**: Create an expense, edit one of its fields and save,
confirm the change persists, then delete a different expense (after
confirming) and confirm it no longer appears anywhere.

### Tests for User Story 2

- [X] T019 [P] [US2] Component test for the expense sheet's edit-mode (pre-filled fields, field changes persist) and delete-confirmation flow (delete blocked until confirmed) in `tests/component/expense-sheet.test.tsx` (extends T008's file)

### Implementation for User Story 2

- [X] T020 [US2] Extend `expensesApi.ts` with `updateExpense` and `deleteExpense` (depends on T006)
- [X] T021 [US2] Extend `useExpenseMutations.ts` with `useUpdateExpense` and `useDeleteExpense` optimistic mutations
- [X] T022 [US2] Extend `ExpenseSheet.tsx` to support edit-mode: pre-filled fields, save calls `useUpdateExpense` (depends on T011 from US1)
- [X] T023 [P] [US2] Create `src/components/ConfirmDialog.tsx` (shared yes/no confirmation prompt)
- [X] T024 [US2] Add a delete action to `ExpenseSheet.tsx` that opens `ConfirmDialog` before calling `useDeleteExpense` (depends on T022, T023)
- [X] T025 [US2] Wire `ExpenseList.tsx` item tap to open `ExpenseSheet` in edit-mode for the tapped expense (depends on T012 from US1, T022)

**Checkpoint**: All three user stories are independently functional and
demonstrable together as Feature F2.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T026 Run `quickstart.md` Scenarios 1–11 manually end-to-end against a real Supabase project — the user ran the app on a physical device against project `tvbyqwnwlrlsxvgemwls` (post-T002) and confirmed add/edit/delete/mark-as-paid all work and persist correctly, including the round-trip through the false-positive-error bug (T034) that this exact manual testing surfaced. All logic is additionally covered by 47/47 automated tests
- [X] T027 [P] Full `tsc --noEmit` typecheck pass across all new/changed files — clean, zero errors

---

## Phase 7: Post-Implementation Patches

Issues found using the sheet in practice, after T001–T027 landed. Tracked
here rather than folded silently into the tasks above, per constitution
VIII (spec-driven delivery — behavior changes get a recorded task, not an
undocumented edit).

- [X] T028 Replace plain `TextInput` with `@gorhom/bottom-sheet`'s `BottomSheetTextInput` for every field in `ExpenseSheet.tsx` — plain `TextInput` doesn't participate in the sheet's keyboard-aware repositioning, so the focused field could end up hidden behind the keyboard; `BottomSheetTextInput` is the library's own keyboard-aware replacement (see research.md #5)
- [X] T029 Fix silent save failures: `ExpenseSheet.handleSave`/`handleConfirmDelete` reset the form and dismissed the sheet immediately after calling `onSave`/`onUpdate`/`onDelete`, regardless of whether the mutation actually succeeded. Changed `onSave`/`onUpdate`/`onDelete` to return `Promise`s (backed by TanStack Query's `mutateAsync` in `app/(tabs)/add.tsx`) and made the sheet `await` them: reset/dismiss only run on success; a failure now shows an inline error and keeps the form (and the user's input) open (see research.md #5)
- [X] T030 Make the add/edit sheet read as a distinct modal instead of a translucent overlay that's easy to confuse with the list underneath: added a dimmed `BottomSheetBackdrop`, a larger snap point (`90%`), and an explicit close (×) button next to the sheet's title (see research.md #5)

**Note**: T029 surfaced that T002 (the `expenses` table migration) still hasn't
been applied to the live Supabase project — every save was failing against
a table that doesn't exist yet, which is why nothing appeared in the list.
T029's fix makes that failure visible (an inline error) instead of silent,
but the underlying blocker is still T002 itself.

---

## Phase 8: Post-Implementation Patches (round 2)

Further issues found using T028–T030 in practice.

- [X] T031 Replace `CategoryPicker`'s native `<Modal>` with an inline expand/collapse list — a `Modal` rendered inside `ExpenseSheet`'s content is nested inside `BottomSheetModal`'s own portaled content, and two native overlay layers fighting over touch/gesture routing is what made the category dropdown "super broken" when opened. The fix removes the second overlay entirely: tapping the collapsed row now expands the category list inline within the same scrollable sheet content (see research.md #6)
- [X] T032 Fix safe-area handling on the sheet itself: passed `topInset={insets.top}` (from `useSafeAreaInsets`) to `BottomSheetModal` so the now-90%-tall sheet doesn't extend under the status bar/notch, and added `insets.bottom` to the content's bottom padding so the Save/Delete buttons aren't obscured by the home indicator / gesture bar (see research.md #6)
- [X] T033 Reordered the sheet's fields to match how the user actually decides: Category → Name → Amount → Recurrence → the recurrence-conditional date field(s) last (Due date / Day / Month+Day), instead of date fields appearing before recurrence was even chosen
- [X] T034 Fix a false-positive "Something went wrong saving..." error shown even when the expense *did* save (and appeared in the list): `handleSave`/`handleConfirmDelete`'s `try` wrapped not just the network call but also the post-save `reset()`/`sheetRef.dismiss()` cleanup, so an unrelated exception from either of those (e.g. dismissing the sheet mid keyboard/animation transition) was misreported as a failed save. Narrowed the `try` to the network call only; cleanup now runs afterward in its own guarded block that can't produce a misleading "save failed" message (see research.md #6)

**Spec sync**: T033's field reordering and the conditional day/month/date
inputs it exposes, plus T034's error-visibility guarantee, were significant
enough user-facing behavior to promote from "patch" to formal requirements
— see spec.md FR-013 (recurrence-conditional due date, year auto-resolved)
and FR-014 (save/delete failures must show an error and preserve input),
plus quickstart.md Scenarios 3b, 10, and 11.

---

## Phase 9: Post-Implementation Patches (round 3)

Issue found using the app on a real device, after T028–T034 landed.

- [X] T035 Fixed a new recurring (monthly/yearly) expense silently anchoring to an already-passed date this cycle — e.g. entering day 5 while on the 20th created an expense due 15 days in the past. `ExpenseSheet.handleSave` now advances the resolved due date one occurrence forward (via the existing `nextOccurrence()`) whenever it's earlier than today and the expense is being newly created (never on edit, which keeps its own anchoring per FR-013). Added an opt-in "Already paid for this cycle — just track it" checkbox, shown only when creating a new monthly/yearly expense, that skips this advance and instead immediately calls the existing `onMarkPaid`/`mark_expense_paid` mutation on the newly created row — reusing US3's roll-forward/history behavior rather than writing separate "create as paid" logic. `onSave`'s return type was narrowed from `Promise<unknown>` to `Promise<Expense>` so the sheet has the created row's real id to pass to `onMarkPaid` (see research.md #7)

**Spec sync**: T035 is significant enough user-facing behavior to amend the
formal requirements — see spec.md's amended FR-013 (forward-advance on
create), new FR-015 (the "already paid" opt-in), new US3 Acceptance
Scenarios 8–9, the refined "due date in the past" Edge Case, new SC-006,
and a new Assumptions entry; plus quickstart.md's new Scenario 10b.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational only
- **User Story 3 (Phase 4)**: Depends on Foundational (T002 for the RPC); T018's UI wiring additionally depends on US1's `ExpenseList.tsx` (T012) existing, though T016/T017 (data layer) and T014/T015 (pure-function tests) can be built in parallel with US1
- **User Story 2 (Phase 5)**: Depends on Foundational; its UI tasks (T022, T025) depend on US1's `ExpenseSheet.tsx`/`ExpenseList.tsx` (T011, T012) existing
- **Polish (Phase 6)**: Depends on all three user stories being complete

### User Story Dependencies

- **US1 (P1)**: No dependency on US2/US3 — testable alone once Foundational is done
- **US3 (P1)**: Data layer (T016/T017) and tests (T014/T015) are independent of US1/US2; the "Mark as paid" UI action (T018) needs somewhere to render, so build order is US1 → US3
- **US2 (P2)**: Needs US1's sheet/list components to extend (T022, T025), so build order is US1 → US2

### Within Each User Story

- Tests written before implementation, and MUST fail first
- Shared/data-layer files before the screens that consume them
- Story complete before moving to the next priority

### Parallel Opportunities

- All Foundational [P] tasks (T003, T004, T005) in parallel; T002 can run alongside them; T006/T007 depend on T002
- Within US1: T008 (test) can be written in parallel with T009–T010 (test-first); T009 and T010 touch different files and can proceed in parallel once T006/T007 exist
- Within US3: T014 and T015 in parallel (different test files, and independent of US1's UI work); T016 depends on T002/T006
- Within US2: T019 in parallel with implementation start; T023 (`ConfirmDialog.tsx`) in parallel with T020/T021 (different files)

---

## Parallel Example: Foundational Phase

```bash
# After T002 (migration) exists, these run together:
Task: "Create src/features/expenses/types.ts"
Task: "Create src/features/expenses/recurrence.ts"
Task: "Create src/features/expenses/validation.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) + Phase 2 (Foundational)
2. Complete Phase 3 (US1: add an expense, see it in a list)
3. **STOP and VALIDATE**: run quickstart.md Scenarios 1–3 by hand
4. This alone proves the core CRUD + offline-cache plumbing works, even
   though recurrence and edit/delete don't exist yet

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. Add US1 → validate add-expense independently
3. Add US3 → validate recurring mark-as-paid roll-forward independently
   (the product's other P1 story — the "never re-enter what repeats" value
   prop)
4. Add US2 → validate edit/delete independently → Feature F2 complete
5. Polish (T026–T027) → full quickstart.md pass

---

## Notes

- [P] tasks touch different files with no unfinished dependency between them
- [Story] labels map tasks back to spec.md's prioritized user stories
- Commit after each task or logical group, per constitution IX (small, mergeable slices)
- Verify each new test fails before writing the implementation that makes it pass
