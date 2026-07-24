import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/useSession";
import {
  createExpense,
  deleteExpense,
  markExpensePaid,
  updateExpense,
} from "@/features/expenses/expensesApi";
import { nextOccurrence } from "@/features/expenses/recurrence";
import {
  expenseHistoryQueryKey,
  plannedExpensesQueryKey,
} from "@/features/expenses/useExpenses";
import { useNotificationReconciliation } from "@/features/rules/useNotificationReconciliation";
import type { CreateExpenseInput, Expense, UpdateExpenseInput } from "@/features/expenses/types";

// Optimistic updates only ever touch the "planned" cache (dashboard +
// reconciliation, research.md #8) — it's a plain array, cheap and safe to
// mutate in place. The paginated "history" cache (the Expenses tab) is left
// to this invalidation to refetch instead of attempting optimistic surgery
// on its page-array shape; that tab is secondary to the dashboard, and a
// brief refetch delay there is an accepted trade-off of adding pagination
// (research.md #8), not an oversight.
async function settleExpenseCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string | undefined
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: plannedExpensesQueryKey(userId) }),
    queryClient.invalidateQueries({ queryKey: expenseHistoryQueryKey(userId) }),
  ]);
}

// Optimistic create: the new row appears in the planned list immediately
// (research.md #4); a temporary client-generated id is replaced once the
// server responds, and rolled back entirely on error.
export function useCreateExpense() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const queryKey = plannedExpensesQueryKey(user?.id);
  const reconcile = useNotificationReconciliation();

  return useMutation({
    mutationFn: (input: CreateExpenseInput) => createExpense(user!.id, input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Expense[]>(queryKey);

      const optimisticExpense: Expense = {
        id: `optimistic-${Date.now()}`,
        user_id: user!.id,
        category_id: input.category_id ?? "",
        name: input.name,
        amount: input.amount,
        currency: "EUR",
        due_date: input.due_date,
        recurrence: input.recurrence ?? null,
        status: "planned",
        paid_at: null,
        rolled_from_id: null,
        notes: input.notes ?? null,
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData<Expense[]>(queryKey, (current) => [
        ...(current ?? []),
        optimisticExpense,
      ]);

      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: async () => {
      await settleExpenseCaches(queryClient, user?.id);
      await reconcile();
    },
  });
}

// Optimistic edit: the changed fields apply to the cached row immediately.
// UpdateExpenseInput never changes `status`, so the row always remains in
// the planned cache after this mutation.
export function useUpdateExpense() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const queryKey = plannedExpensesQueryKey(user?.id);
  const reconcile = useNotificationReconciliation();

  return useMutation({
    mutationFn: (input: UpdateExpenseInput) => updateExpense(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Expense[]>(queryKey);

      queryClient.setQueryData<Expense[]>(queryKey, (current) =>
        (current ?? []).map((row) => (row.id === input.id ? { ...row, ...input } : row))
      );

      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: async () => {
      await settleExpenseCaches(queryClient, user?.id);
      await reconcile();
    },
  });
}

// Optimistic delete: the row disappears immediately if present (harmless
// no-op if the deleted expense wasn't planned, since it wouldn't be in this
// cache to begin with); FR-005's confirmation step happens in the UI before
// this mutation is ever called.
export function useDeleteExpense() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const queryKey = plannedExpensesQueryKey(user?.id);
  const reconcile = useNotificationReconciliation();

  return useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Expense[]>(queryKey);

      queryClient.setQueryData<Expense[]>(queryKey, (current) =>
        (current ?? []).filter((row) => row.id !== id)
      );

      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: async () => {
      await settleExpenseCaches(queryClient, user?.id);
      await reconcile();
    },
  });
}

// Optimistically removes the paid row from the planned cache (it no longer
// belongs in a planned-only result) and, for a recurring expense, previews
// the next occurrence locally via recurrence.ts — but the actual
// roll-forward row (and its real id/date) comes from the mark_expense_paid
// RPC (research.md #1); onSettled's invalidate reconciles the cache with
// whatever the server actually did, including the idempotent no-op on a
// repeated call (FR-010). Reconciliation runs after that invalidation (not
// before) so a rolled-forward recurring expense's notifications are
// scheduled against its real id/due_date, not the optimistic placeholder
// (FR-015).
export function useMarkExpensePaid() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const queryKey = plannedExpensesQueryKey(user?.id);
  const reconcile = useNotificationReconciliation();

  return useMutation({
    mutationFn: (expense: Expense) => markExpensePaid(expense.id),
    onMutate: async (expense) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Expense[]>(queryKey);

      queryClient.setQueryData<Expense[]>(queryKey, (current) => {
        const rows = (current ?? []).filter((row) => row.id !== expense.id);

        if (expense.recurrence === "monthly" || expense.recurrence === "yearly") {
          rows.push({
            ...expense,
            id: `optimistic-${Date.now()}`,
            status: "planned",
            paid_at: null,
            rolled_from_id: expense.id,
            due_date: nextOccurrence(expense.due_date, expense.recurrence),
          });
        }

        return rows;
      });

      return { previous };
    },
    onError: (_error, _expense, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: async () => {
      await settleExpenseCaches(queryClient, user?.id);
      await reconcile();
    },
  });
}
