# Research: Expense CRUD & Recurrence

## 1. Atomic mark-as-paid roll-forward (FR-008, FR-010)

**Decision**: Implement mark-as-paid as a single Postgres function
(`mark_expense_paid(expense_id uuid)`) invoked via
`supabase.rpc('mark_expense_paid', { expense_id })`, executed inside the
function body as one transaction: set the target row's `status = 'paid'`,
and — only if its `recurrence` is `'monthly'` or `'yearly'` — insert exactly
one new row for the next occurrence, all in the same statement/transaction.
The function is idempotent by construction: it only inserts a roll-forward
row when it successfully transitions the target row from `status = 'planned'`
to `'paid'` (`UPDATE ... WHERE id = $1 AND status = 'planned' RETURNING ...`);
a second call against an already-paid row updates zero rows and therefore
skips the insert.

**Rationale**: Doing "flip status" and "insert next occurrence" as two
separate client round-trips creates a window where a double-tap or a retried
request (e.g., a flaky network retry) can flip status twice or insert twice.
A single `UPDATE ... RETURNING` gated on the old status, combined with
`INSERT` only running off that `RETURNING` result, makes the whole operation
race-proof without needing a client-side mutex or a unique constraint
work-around. This satisfies FR-010 directly rather than relying on the
client to de-duplicate.

**Alternatives considered**:
- *Client-side two-step (update, then insert)*: rejected — the exact race
  the spec's edge cases call out ("double tap") is possible between the two
  round-trips.
- *Unique constraint on (source expense, period) to reject duplicate
  roll-forwards*: rejected as the primary mechanism — adds schema complexity
  for a problem the status-gated update already solves; could be revisited
  as a defense-in-depth measure later but isn't needed for MVP1.
- *Database trigger on `UPDATE` of `expenses.status`*: rejected — triggers
  hide the roll-forward behavior from anyone reading the function that
  performs it, and are harder to unit-test than an explicit RPC function.

## 2. Recurrence date-rolling math (FR-008, month-end clamping edge case)

**Decision**: Implement a small pure function
`nextOccurrence(dueDate: string, recurrence: 'monthly' | 'yearly'): string`
in `src/features/expenses/recurrence.ts` using native `Date` arithmetic: add
1 month or 1 year to the year/month, then clamp the day to the last valid
day of the resulting month if the original day doesn't exist there (e.g.,
Jan 31 + 1 month → Feb 28/29, not Mar 3).

**Rationale**: The rolling rule needed here is narrow (exactly two
intervals, always +1 unit, with one clamping rule) — small enough that a
dependency-free implementation is easier to read, test, and reason about
than pulling in a date library for one function. This matches the project's
existing pattern of minimal dependencies (F1 added no date library either).

**Alternatives considered**:
- *`date-fns`*: rejected for now — solid library, but adds a dependency for
  a single function's worth of logic; revisit if a later feature needs
  broader date arithmetic (e.g., F7's month navigation).
- *Postgres `date + interval '1 month'`*: rejected as the sole implementation
  — Postgres's own month-end behavior (`'2026-01-31'::date + interval '1
  month'` → `2026-03-03`, not clamped) doesn't match the spec's required
  clamping behavior, so clamping logic is needed either way; doing it in the
  same SQL function as the roll-forward (research item 1) means the clamping
  lives in Postgres in `mark_expense_paid`, while the pure TS version in
  `recurrence.ts` exists for client-side preview (e.g., showing the user
  "next due: Feb 28" before they confirm) and is unit-tested independently.

## 3. Add/edit sheet UI (FR-001, FR-004)

**Decision**: Use `@gorhom/bottom-sheet` for the add/edit expense sheet.

**Rationale**: `react-native-gesture-handler` and `react-native-reanimated`
are already project dependencies (installed for Expo Router in F1), which
are `@gorhom/bottom-sheet`'s only peer dependencies — so adopting it adds no
new native-module surface to test or configure, while giving the "smooth
add-expense sheet" the product spec (`docs/mindyourmoney-spec.md` §6) calls
for, versus a bare `Modal` which would need custom gesture/animation work to
reach the same feel.

**Alternatives considered**:
- *React Native's built-in `Modal`*: rejected as the primary interaction —
  works, but reaching a "smooth sheet" feel requires re-implementing drag-
  to-dismiss and animation that `@gorhom/bottom-sheet` already provides.
- *A full-screen route (`app/(tabs)/add-expense-modal.tsx`) via Expo
  Router's modal presentation*: viable alternative, not chosen because the
  product spec explicitly describes a "sheet," and a bottom sheet keeps the
  user's place in the underlying tab visible, which a full-screen modal
  route would hide.

## 4. Offline-tolerant expense list & mutations (constitution IV)

**Decision**: Reuse the existing TanStack Query client from F1
(`src/lib/queryClient.ts`, `networkMode: 'offlineFirst'`). Expense list reads
use query key `['expenses', userId]`; create/update/delete/markPaid are
TanStack Query mutations with optimistic updates (`onMutate` writes the
expected result into the cache immediately, `onError` rolls back, `onSuccess`
reconciles with the server response) so the UI never blocks on network for
a save the user just performed on-screen.

**Rationale**: This is the same offline-tolerant pattern F1 already
established for categories; reusing it keeps the two features consistent
and avoids introducing a second caching strategy in the same app.

**Alternatives considered**:
- *Direct Supabase calls with local component state, no TanStack Query*:
  rejected — would lose the offline-cache behavior constitution IV requires
  and duplicate cache-invalidation logic that TanStack Query already
  provides.

## 5. Post-implementation patches (Phase 7)

**Decision (keyboard)**: Use `@gorhom/bottom-sheet`'s own `BottomSheetTextInput`
for every field in `ExpenseSheet`, not React Native's plain `TextInput`.

**Rationale**: The sheet's `keyboardBehavior="interactive"` only repositions
the sheet correctly when the focused input is one the library is tracking;
a plain `TextInput` isn't wired into that tracking, so the focused field can
still end up behind the keyboard. `BottomSheetTextInput` is a drop-in
replacement built for exactly this.

**Decision (silent failures)**: `onSave`/`onUpdate`/`onDelete` are now
`Promise`-returning (backed by TanStack Query's `mutateAsync`), and
`ExpenseSheet` awaits them before resetting the form or dismissing itself;
a rejected promise sets an inline "submit" error and leaves the form open
with the user's input intact.

**Rationale**: The sheet previously reset and dismissed immediately after
*calling* the mutation, not after it *resolved* — so a failed save (e.g.
against a table that doesn't exist yet) looked identical to a successful
one: the form cleared, the sheet closed, and the optimistically-added row
was silently rolled back moments later. This violates the spirit of
constitution IV/offline-tolerance: a failure must be visible, not silently
swallowed.

**Alternatives considered**:
- *Keep `mutate` (fire-and-forget) and rely on the optimistic cache entry
  alone*: rejected — this is exactly the behavior that produced the bug;
  optimistic updates are for perceived latency, not for hiding real
  failures from the user.

**Decision (distinct modal feel)**: Added a dimmed `BottomSheetBackdrop`
(`appearsOnIndex={0}`, `pressBehavior="close"`), a larger snap point
(`90%`), and an explicit close (×) button next to the title.

**Rationale**: Without a backdrop the sheet reads as only a partial overlay
on top of the still-fully-visible, still-interactive list underneath,
making it easy to lose track of whether an add/edit action is in progress.
A dimmed backdrop plus a near-full-height sheet makes the add/edit flow
read as its own distinct step, consistent with the product's "smooth
add-expense sheet" baseline (`docs/mindyourmoney-spec.md` §6).

## 6. Post-implementation patches, round 2 (Phase 8)

**Decision (category dropdown)**: Replaced `CategoryPicker`'s native
`<Modal>` with an inline expand/collapse section rendered directly in the
sheet's own scrollable content — no second overlay component at all.

**Rationale**: A `<Modal>` declared inside `ExpenseSheet`'s children is, at
runtime, nested inside `BottomSheetModal`'s own portaled content (the
library renders its children through a portal to the app root). Two
independent native overlay layers stacked this way is a known-broken
combination on both iOS and Android — touch/gesture routing between them
gets confused, which is exactly what "super broken when opened" was. With
only 11 default categories, an inline (non-virtualized) list is trivially
cheap to render in full once expanded — no FlatList, no second Modal, no
portal-in-portal — and the sheet's own `BottomSheetScrollView` already
handles scrolling the whole form, category list included.

**Alternatives considered**:
- *A second, nested `BottomSheetModal` for the picker*: rejected — nested
  bottom sheets are possible but require careful ref/gesture coordination
  the library itself cautions about; unnecessary complexity for what's
  fundamentally a small, static list.
- *`BottomSheetFlatList` inline instead of a plain mapped list*: rejected
  for now — virtualization only pays off at list sizes far larger than 11
  items; a plain list is simpler and has nothing to go wrong.

**Decision (sheet safe-area)**: `BottomSheetModal` now receives
`topInset={insets.top}` from `useSafeAreaInsets()`, and the content's
bottom padding adds `insets.bottom`.

**Rationale**: Once the sheet grew to a `90%` snap point (research.md #5),
its top edge could extend up under the status bar/notch, since
`snapPoints` percentages are computed against the raw window height, not
the safe area — the same class of bug fixed elsewhere in the app (see F1
tasks), just resurfacing inside a component (`BottomSheetModal`) that isn't
itself a `SafeAreaView` and needed the inset handed to it explicitly.

**Decision (field order)**: Reordered the sheet to Category → Name →
Amount → Recurrence → the recurrence-conditional date field(s).

**Rationale**: Matches the order a user actually decides in — which
bucket this belongs to, what it's called, how much, how often, and only
then (if not obvious from "how often") the specific date — per explicit
product feedback. Placing recurrence before the date field(s) also makes
the conditional-field behavior (research.md #2) legible as you fill the
form top-to-bottom, rather than seeing a date field that then disappears
once you scroll down to recurrence.

**Decision (false-positive save error)**: Narrowed `handleSave`'s/
`handleConfirmDelete`'s `try` block to cover only the `onSave`/`onUpdate`/
`onDelete` network call. `reset()` and `sheetRef.current?.dismiss()` now
run afterward, unconditionally on success, inside their *own* guarded
block that swallows (rather than surfaces as a save/delete error) any
exception from the cleanup step itself.

**Rationale**: A user reported the sheet showing "Something went wrong
saving..." while the expense had, in fact, saved and was visible in the
list. The `try` block introduced in T029 wrapped `reset()`/`dismiss()` as
well as the network call — so once the save genuinely succeeded, any
unrelated exception from dismissing the sheet (e.g. a gesture/animation
timing issue while a keyboard dismiss was still in flight) was caught by
the same `catch` and misreported as a failed save. Success and "did the
UI finish tidying up afterward" are two different questions; conflating
them is exactly what produced this false positive. A regression test
(`tests/component/expense-sheet.test.tsx`, "never shows a save error when
the save itself succeeds, even if closing the sheet afterward throws")
simulates `dismiss()` throwing after a successful `onSave` and asserts no
error is shown.

**Alternatives considered**:
- *Leave `dismiss()` unguarded after a successful save*: rejected — while
  it would no longer show a misleading error, a genuine exception there
  would go uncaught and could crash the render tree; wrapping it in its
  own no-op `catch` is safer without reintroducing the false positive.

## 7. Post-implementation patches, round 3 (Phase 9)

**Decision (default anchoring rolls forward when past-due)**: When creating
a new "monthly"/"yearly" expense (not editing), `ExpenseSheet.handleSave`
now checks whether the resolved due date (`resolveMonthlyDueDate`/
`resolveYearlyDueDate`, anchored to today's year/month per FR-013) is
earlier than today. If so, it calls `nextOccurrence()` on that resolved
date once before saving, landing on the following month/year's occurrence
instead.

**Rationale**: A user reported that entering, e.g., day 5 while on the
20th of the month created an expense due 15 days in the past — surprising
for a forward-looking tracker, since "day 5, monthly" describes a
recurring future obligation, not a historical record. Anchoring to
"today's year/month" unconditionally (the original FR-013 behavior) was
correct for same-day-or-later entries but wrong once the chosen day had
already elapsed this cycle. Reusing `nextOccurrence()` — the exact same
roll-forward function `mark_expense_paid` already uses server-side — keeps
this one, already-tested piece of date math as the single source of truth
for "what's the next occurrence after X," rather than writing a second,
parallel implementation.

**Decision (opt-in "already paid" checkbox)**: Added a checkbox, visible
only when creating (not editing) a "monthly"/"yearly" expense, that — when
checked — (a) skips the forward-advance above, keeping the exact entered
(possibly past) due date, and (b) immediately calls the same
`onMarkPaid`/`mark_expense_paid` mutation the Home/Add "mark as paid"
action already uses (F3 research.md #6), via the newly created expense's
real id returned from `onSave`.

**Rationale**: The forward-advance above is the right *default*, but some
users genuinely want to back-fill a bill they already paid before they
started tracking it in the app (e.g. "I paid this month's rent already,
just start tracking it from here"). Rather than inventing new "create
already-paid" logic, reusing the existing atomic mark-as-paid RPC gets
history-preservation and next-occurrence creation for free, and guarantees
this path can never disagree with the regular mark-as-paid flow about what
"paid and rolled forward" means. `onSave`'s return type was narrowed from
`Promise<unknown>` to `Promise<Expense>` so the sheet has the real created
row (with its server-assigned id) to pass to `onMarkPaid`.

**Alternatives considered**:
- *Let the user type any date, including past ones, with no default
  advance.* Rejected — this was the reported bug; a forward-looking
  tracker should not silently schedule "next due" in the past by default.
- *Block saving a past-resolved date outright, with a validation error.*
  Rejected — this removes the legitimate "log a bill I already paid"
  use case entirely, forcing the user to either lie about the date or use
  a workaround; an explicit opt-in is more honest and more useful.
- *Write separate "create as paid" logic in `expensesApi.createExpense`
  (e.g. an initial `status`/`paid_at` parameter on insert).* Rejected —
  would duplicate the roll-forward-on-paid behavior `mark_expense_paid`
  already implements atomically and idempotently; calling the existing
  mutation after creation reuses that logic instead of re-deriving it.
