import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/useSession";
import {
  listCategoryOptions,
  listExpensesPage,
  listPlannedExpenses,
} from "@/features/expenses/expensesApi";

const HISTORY_PAGE_SIZE = 50;

export function plannedExpensesQueryKey(userId: string | undefined) {
  return ["expenses", "planned", userId] as const;
}

// Backs the Dashboard and notification reconciliation (research.md #8) —
// deliberately not paginated, see expensesApi.ts's listPlannedExpenses.
export function usePlannedExpenses() {
  const { user } = useSession();

  return useQuery({
    queryKey: plannedExpensesQueryKey(user?.id),
    queryFn: () => listPlannedExpenses(user!.id),
    enabled: !!user,
  });
}

export function expenseHistoryQueryKey(userId: string | undefined) {
  return ["expenses", "history", userId] as const;
}

// Backs the "Expenses" tab's full browsable history (FR-014) — paginated so
// initial load time doesn't grow with account age.
export function useExpenseHistory() {
  const { user } = useSession();

  return useInfiniteQuery({
    queryKey: expenseHistoryQueryKey(user?.id),
    queryFn: ({ pageParam }) =>
      listExpensesPage(user!.id, { from: pageParam, to: pageParam + HISTORY_PAGE_SIZE - 1 }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < HISTORY_PAGE_SIZE ? undefined : allPages.length * HISTORY_PAGE_SIZE,
    enabled: !!user,
  });
}

export function categoryOptionsQueryKey(userId: string | undefined) {
  return ["categoryOptions", userId] as const;
}

export function useCategoryOptions() {
  const { user } = useSession();

  return useQuery({
    queryKey: categoryOptionsQueryKey(user?.id),
    queryFn: () => listCategoryOptions(user!.id),
    enabled: !!user,
  });
}
