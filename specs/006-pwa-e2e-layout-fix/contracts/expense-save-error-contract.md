# Contract: When Expense-Save Errors May Surface

Defines the boundary FR-001/FR-002/FR-003 draw between "a real save
failure" and "something else went wrong after the save succeeded," so the
fix in `ExpenseSheet.tsx` / `useExpenseMutations.ts` /
`useNotificationReconciliation.ts` has a precise target instead of a vague
"stop showing the error."

## MUST show an error to the user

- The Supabase `insert` in `createExpense` (`expensesApi.ts`) itself
  rejects (network failure, RLS rejection, constraint violation, etc.) —
  i.e. `mutationFn` in `useCreateExpense` throws.
- `settleExpenseCaches`'s cache invalidation fails in a way that leaves
  the UI unable to reflect the new expense (should still be rare/logged,
  but is at least plausibly save-related from the user's point of view).

## MUST NOT show an error to the user

- The Supabase insert succeeded (row exists, dashboard reflects it) but a
  subsequent, unrelated step in the same `onSettled` block throws —
  specifically: local notification reconciliation
  (`reconcileScheduledNotifications`) failing or being unsupported on the
  current platform (e.g. web). This is the defect fixed by this feature
  (research.md #1).
- Push-token (server) registration (`registerPush`) failing — already
  correctly isolated today via its own `.catch()` in
  `useNotificationReconciliation.ts`; this contract exists to keep that
  precedent, not change it.

## Non-goal

This contract does not change *whether* reconciliation is attempted —
Constitution V still requires it run as part of the same mutation. It
changes only whether reconciliation's own failure is reported to the user
as if the expense save itself failed. Reconciliation failures MUST still
be logged (e.g. `console.error`, matching the existing `registerPush`
pattern) so they remain diagnosable, just not user-facing as a save error.
