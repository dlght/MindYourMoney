import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  MAX_MONTHS_AHEAD,
  biggestUpcoming,
  getTodayIso,
  groupByMonthWindow,
  monthWindowLabel,
  upcomingTotal,
} from "@/features/dashboard/selectors";
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
  const [monthsAhead, setMonthsAhead] = useState(0);

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

  const groups = groupByMonthWindow(expenses, todayIso, monthsAhead);
  const total = upcomingTotal(expenses, todayIso, monthsAhead);
  const biggest = biggestUpcoming(expenses, todayIso, monthsAhead);
  const windowLabel = monthWindowLabel(todayIso, monthsAhead);

  const emptyMessage =
    expenses.length === 0
      ? "No expenses yet. Add one from the Add tab to get started."
      : `Nothing due in ${windowLabel}.`;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white dark:bg-slate-900">
      <ScrollView contentContainerStyle={{ paddingBottom: 24, gap: 16 }}>
        <View className="px-6 py-4">
          <Text accessibilityRole="header" className="text-xl font-semibold text-slate-900 dark:text-white">
            Home
          </Text>
        </View>
        <UpcomingTotalCard total={total} windowLabel={windowLabel} />
        <BiggestExpenseCard biggest={biggest} windowLabel={windowLabel} />
        <UpcomingList groups={groups} emptyMessage={emptyMessage} onMarkPaid={onMarkPaid} />
        <View className="flex-row justify-center gap-4 px-6">
          {monthsAhead < MAX_MONTHS_AHEAD ? (
            <Pressable
              onPress={() => setMonthsAhead((current) => current + 1)}
              accessibilityRole="button"
              className="min-h-[44px] items-center justify-center rounded-lg border border-slate-300 px-5 py-3 dark:border-slate-600"
            >
              <Text className="font-medium text-slate-700 dark:text-slate-300">Show next month</Text>
            </Pressable>
          ) : null}
          {monthsAhead > 0 ? (
            <Pressable
              onPress={() => setMonthsAhead(0)}
              accessibilityRole="button"
              className="min-h-[44px] items-center justify-center rounded-lg px-5 py-3"
            >
              <Text className="font-medium text-slate-500 dark:text-slate-400">Show less</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
