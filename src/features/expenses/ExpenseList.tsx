import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import type { Expense } from "@/features/expenses/types";

interface ExpenseListProps {
  expenses: Expense[];
  onMarkPaid?: (expense: Expense) => void;
  onSelectExpense?: (expense: Expense) => void;
  // Pagination (F5, FR-014): the Expenses tab's history is now paginated
  // rather than fetched unbounded in one request — these are optional so
  // this component still works standalone (e.g. in tests) without wiring
  // an infinite query.
  onEndReached?: () => void;
  isFetchingNextPage?: boolean;
}

// Interim listing surface for F2 — F3 replaces this with the full "next 30
// days" Home dashboard (grouping, totals, biggest-expense highlight). This
// exists only so added/edited/recurring expenses are visible and selectable
// within this feature, ahead of F3 landing.
export function ExpenseList({
  expenses,
  onMarkPaid,
  onSelectExpense,
  onEndReached,
  isFetchingNextPage,
}: ExpenseListProps) {
  if (expenses.length === 0) {
    return (
      <View className="items-center px-6 py-8">
        <Text className="text-slate-600 dark:text-slate-400">No expenses yet.</Text>
      </View>
    );
  }

  return (
    <FlatList
      testID="expense-list"
      data={expenses}
      keyExtractor={(expense) => expense.id}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 8 }}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        isFetchingNextPage ? (
          <View className="items-center py-4" testID="expense-list-loading-more">
            <ActivityIndicator />
          </View>
        ) : null
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => onSelectExpense?.(item)}
          className="flex-row items-center justify-between rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-700"
          accessibilityRole="button"
          accessibilityLabel={`Expense: ${item.name}`}
        >
          <View>
            <Text className="font-medium text-slate-900 dark:text-white">{item.name}</Text>
            <Text className="text-sm text-slate-600 dark:text-slate-400">{item.due_date}</Text>
          </View>
          <View className="items-end gap-1">
            <Text className="font-medium text-slate-900 dark:text-white">
              {item.amount.toFixed(2)} {item.currency}
            </Text>
            <Text className="text-sm text-slate-600 dark:text-slate-400">{item.status}</Text>
            {item.status === "planned" && onMarkPaid ? (
              <Pressable
                onPress={() => onMarkPaid(item)}
                accessibilityRole="button"
                accessibilityLabel={`Mark ${item.name} as paid`}
                className="rounded-full bg-green-600 px-3 py-1"
              >
                <Text className="text-xs font-medium text-white">Mark as paid</Text>
              </Pressable>
            ) : null}
          </View>
        </Pressable>
      )}
    />
  );
}
