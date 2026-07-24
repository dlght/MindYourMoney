import { DashboardScreen } from "@/features/dashboard/DashboardScreen";
import { usePlannedExpenses } from "@/features/expenses/useExpenses";
import { useMarkExpensePaid } from "@/features/expenses/useExpenseMutations";

export default function HomeScreen() {
  const { data: expenses, isError, refetch } = usePlannedExpenses();
  const markExpensePaid = useMarkExpensePaid();

  return (
    <DashboardScreen
      expenses={expenses}
      isError={isError}
      onRetry={() => refetch()}
      onMarkPaid={(expense) => markExpensePaid.mutate(expense)}
    />
  );
}
