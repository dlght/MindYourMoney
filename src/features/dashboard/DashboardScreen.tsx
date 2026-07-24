import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { biggestUpcoming, getTodayIso, groupNext30Days, upcomingTotal } from "@/features/dashboard/selectors";
import { UpcomingList } from "@/features/dashboard/UpcomingList";
import { UpcomingTotalCard } from "@/features/dashboard/UpcomingTotalCard";
import { BiggestExpenseCard } from "@/features/dashboard/BiggestExpenseCard";
import type { Expense } from "@/features/expenses/types";

interface DashboardScreenProps {
  // undefined = no successful fetch yet (first load, or a hard failure with
  // nothing cached); once populated, this holds even if a later refetch
  // errors (FR-010) — TanStack Query's `data` keeps the last good value.
  expenses: Expense[] | undefined;
  isError: boolean;
  onRetry: () => void;
  onMarkPaid: (expense: Expense) => void;
  todayIso?: string;
}

export function DashboardScreen({
  expenses,
  isError,
  onRetry,
  onMarkPaid,
  todayIso = getTodayIso(),
}: DashboardScreenProps) {
  if (!expenses) {
    if (isError) {
      return (
        <SafeAreaView
          edges={["top"]}
          className="flex-1 items-center justify-center gap-4 bg-white px-6 dark:bg-slate-900"
        >
          <Text className="text-center text-slate-600 dark:text-slate-400">
            Something went wrong loading your expenses.
          </Text>
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            className="rounded-lg bg-indigo-600 px-4 py-2"
          >
            <Text className="font-medium text-white">Retry</Text>
          </Pressable>
        </SafeAreaView>
      );
    }

    return <SafeAreaView edges={["top"]} className="flex-1 bg-white dark:bg-slate-900" />;
  }

  const groups = groupNext30Days(expenses, todayIso);
  const total = upcomingTotal(expenses, todayIso);
  const biggest = biggestUpcoming(expenses, todayIso);

  const emptyMessage =
    expenses.length === 0
      ? "No expenses yet. Add one from the Add tab to get started."
      : "Nothing due in the next 30 days.";

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white dark:bg-slate-900">
      <ScrollView contentContainerStyle={{ paddingBottom: 24, gap: 16 }}>
        <View className="px-6 py-4">
          <Text className="text-xl font-semibold text-slate-900 dark:text-white">Home</Text>
        </View>
        <UpcomingTotalCard total={total} />
        <BiggestExpenseCard biggest={biggest} />
        <UpcomingList groups={groups} emptyMessage={emptyMessage} onMarkPaid={onMarkPaid} />
      </ScrollView>
    </SafeAreaView>
  );
}
