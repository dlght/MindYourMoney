# Quickstart: Expense CRUD & Recurrence

Validation guide for Feature F2. Assumes the implementation tasks in
`tasks.md` have been completed, and F1 (auth + seeded categories) is already
in place.

## Prerequisites

- Node.js LTS and the Expo CLI (`npx expo` — no global install needed)
- A Supabase project (free tier) with:
  - F1's migration (`categories` table) already applied
  - The migration in `contracts/expenses-schema.sql` applied
- A signed-in test account with default categories seeded (per F1)

## Setup

```bash
npm install
npx expo start
```

Open the app in Expo Go or a simulator/emulator from the CLI output, signed
in with a test account.

## Scenario 1 — Add an expense (User Story 1)

1. Tap the Add tab, then tap Add to open the sheet.
2. Tap the compact category row, pick a category from the list it expands
   into, enter a name and a positive amount, leave recurrence as "None",
   and enter a due date.
3. Save.
4. **Expect**: the sheet closes, and the new expense exists with
   `status = 'planned'` and exactly the entered values (check via Supabase
   dashboard/SQL against the `expenses` table, or confirm it now appears in
   the in-app list).

## Scenario 2 — Validation blocks a bad amount (Edge Case, FR-002)

1. Open the Add sheet.
2. Enter a name but leave amount blank, or enter `0` or a negative number.
3. Attempt to save.
4. **Expect**: a validation message appears and no network call is made
   (no new row appears in `expenses`).

## Scenario 3 — Category defaults to "Other" (FR-003)

1. Open the Add sheet.
2. Enter a name, amount, and due date, but do not tap the category row at
   all (it's collapsed showing "Other" by default).
3. Save.
4. **Expect**: the new expense's `category_id` resolves to the signed-in
   user's "Other" category.

## Scenario 3b — Category picker stays compact (FR-013 UI, spec Assumptions)

1. Open the Add sheet with a real account that has all 11 default
   categories.
2. **Expect**: only a single collapsed row is shown for Category — not all
   11 options at once.
3. Tap the row.
4. **Expect**: it expands in place to show the full list; tapping any
   category selects it and collapses the list again.

## Scenario 4 — Edit an existing expense (User Story 2)

1. Open an existing expense from Scenario 1.
2. Change its amount and due date.
3. Save.
4. **Expect**: the row in `expenses` reflects the new values immediately.

## Scenario 5 — Delete requires confirmation (User Story 2, FR-005)

1. Open an existing expense.
2. Trigger delete.
3. **Expect**: a confirmation prompt appears before anything is removed.
4. Confirm.
5. **Expect**: the row no longer exists in `expenses`.

## Scenario 6 — Recurring expense rolls forward on mark-as-paid (User Story 3, FR-008)

1. Create an expense with `recurrence = 'monthly'` and due date, e.g.,
   `2026-01-31`.
2. Mark it as paid.
3. **Expect**: the original row's `status` becomes `'paid'`, and a new row
   exists with the same name/amount/category, `status = 'planned'`, due
   `2026-02-28` (clamped — see data-model.md), and `rolled_from_id` pointing
   at the original.
4. Repeat with `recurrence = 'yearly'` on a leap-day due date (e.g.,
   `2028-02-29`) and confirm the next occurrence lands on `2029-02-28`.

## Scenario 7 — No double roll-forward on repeated mark-as-paid (Edge Case, FR-010)

1. Take the expense marked paid in Scenario 6.
2. Call mark-as-paid again on the same (now-paid) expense id — e.g., by
   rapidly double-tapping the action, or by invoking the RPC twice in a row.
3. **Expect**: still exactly one roll-forward row exists from that original
   expense — no second occurrence was created.

## Scenario 8 — Non-recurring expense does not roll forward (FR-009)

1. Create an expense with `recurrence = null`.
2. Mark it as paid.
3. **Expect**: its `status` becomes `'paid'` and no new expense is created.

## Scenario 9 — Ownership isolation (FR-011)

1. Using two different signed-in accounts, confirm neither can see, edit, or
   delete the other's expenses (e.g., attempt a direct API call with
   account A's session against account B's expense id).
2. **Expect**: the request returns no rows / is rejected by RLS.

## Scenario 10 — Recurrence-conditional due date entry (User Story 3, FR-013)

1. Open the Add sheet and enter a name, amount, and category.
2. Leave recurrence as "None". **Expect**: a single full-date field
   ("Due date (YYYY-MM-DD)") is shown.
3. Switch recurrence to "Monthly". **Expect**: the full-date field is
   replaced by a single "Day of month (1-31)" field — no year or month
   shown.
4. Enter a day, e.g. `31`, in a month with fewer days (e.g. save it in
   April). Save. **Expect**: the stored `due_date`'s day is clamped to the
   30th, not the 31st.
5. Switch recurrence to "Yearly" on a new expense. **Expect**: two fields
   appear — "Month (1-12)" and "Day (1-31)" — still no year shown.
6. Open an existing monthly/yearly expense for editing, change only the
   day (or month), and save. **Expect**: the stored due date's year (and,
   for monthly, month) stays the same as before the edit — it does not
   reset to the current year/month.

## Scenario 10b — New recurring expense advances past a due date already passed this cycle (User Story 3, FR-013/FR-015)

1. Note today's date, e.g. the 20th of the month.
2. Open the Add sheet, enter a name/amount/category, set recurrence to
   "Monthly", and enter a day earlier than today, e.g. `5`.
3. Save without checking any additional option. **Expect**: the created
   expense's due date is next month's 5th, not this month's (already
   passed) 5th.
4. Create another new monthly expense the same way, but this time check
   "Already paid for this cycle — just track it" before saving. **Expect**:
   the created expense's due date is this month's 5th (the exact entered,
   past date), its status is immediately "paid", and a second, "planned"
   expense appears due next month's 5th — i.e. identical in effect to
   Scenario 6's mark-as-paid roll-forward.
5. Repeat step 2–3 for "Yearly" with a month/day combination already passed
   this year (e.g. January if today is in August). **Expect**: the created
   expense's due date is next year's, not this year's already-passed one.

## Scenario 11 — Save/delete failure shows an error, not silence (Edge Case, FR-014)

1. Temporarily make a save fail (e.g., point the app at a Supabase project
   without the `expenses` table/migration applied, or disconnect network
   mid-request).
2. Attempt to add an expense.
3. **Expect**: an inline error message appears in the sheet, the sheet
   stays open, and the entered name/amount/etc. are still there to retry
   with — the form must not clear or the sheet dismiss as if it had saved.
4. Repeat for delete: confirm a delete that then fails.
5. **Expect**: an inline error message appears; the expense is not removed
   from the list.

## Automated coverage

- `tests/unit/recurrence.test.ts` — covers Scenario 6's date-rolling math,
  including the month-end/leap-day clamping cases, independent of the
  database; also covers `resolveMonthlyDueDate`/`resolveYearlyDueDate`
  (Scenario 10's clamping-at-entry behavior).
- `tests/unit/expensesApi.test.ts` — covers Scenario 7's idempotency and
  Scenario 8's no-roll-forward behavior against a mocked Supabase client.
- `tests/component/expense-sheet.test.tsx` — covers Scenarios 1–3's add/
  validation/category-default UI states, Scenario 3b's collapsed/expanded
  category picker, Scenario 10's conditional day/month/date fields and
  edit-time year anchoring, Scenario 10b's default forward-advance for a
  new recurring expense whose day/month has already passed this cycle and
  the "already paid" opt-in (both monthly and yearly), and Scenario 11's
  save/delete failure handling (including that a successful save is never
  mistakenly reported as failed).
