import { Text, View } from "react-native";
import type { BiggestUpcoming } from "@/features/dashboard/types";

interface BiggestExpenseCardProps {
  biggest: BiggestUpcoming;
}

export function BiggestExpenseCard({ biggest }: BiggestExpenseCardProps) {
  if (!biggest.expense) {
    return (
      <View className="mx-4 rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-700">
        <Text className="text-sm text-slate-600 dark:text-slate-400">
          Nothing big due in the next 30 days.
        </Text>
      </View>
    );
  }

  const { expense } = biggest;

  return (
    <View className="mx-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950">
      <Text className="text-sm font-medium text-amber-700 dark:text-amber-300">Biggest upcoming</Text>
      <Text className="text-lg font-semibold text-slate-900 dark:text-white">{expense.name}</Text>
      <Text className="text-slate-600 dark:text-slate-400">
        {expense.amount.toFixed(2)} {expense.currency} · due {expense.due_date}
      </Text>
    </View>
  );
}
