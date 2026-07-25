import { useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useExpenseHistory, useCategoryOptions } from "@/features/expenses/useExpenses";
import {
  useCreateExpense,
  useDeleteExpense,
  useMarkExpensePaid,
  useUpdateExpense,
} from "@/features/expenses/useExpenseMutations";
import { ExpenseSheet, type ExpenseSheetHandle } from "@/features/expenses/ExpenseSheet";
import { ExpenseList } from "@/features/expenses/ExpenseList";

export default function AddScreen() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useExpenseHistory();
  const expenses = data?.pages.flat() ?? [];
  const { data: categories = [] } = useCategoryOptions();
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();
  const markExpensePaid = useMarkExpensePaid();
  const sheetRef = useRef<ExpenseSheetHandle>(null);

  return (
    // edges omits "bottom": the tab bar below this screen already accounts
    // for the bottom safe-area inset, so adding it again here would leave a
    // double gap above the tab bar.
    <SafeAreaView edges={["top"]} className="flex-1 bg-white dark:bg-slate-900">
      <View className="flex-row items-center justify-between px-6 py-4">
        <Text accessibilityRole="header" className="text-xl font-semibold text-slate-900 dark:text-white">
          Expenses
        </Text>
        <Pressable
          onPress={() => sheetRef.current?.present()}
          accessibilityRole="button"
          className="min-h-[44px] items-center justify-center rounded-lg bg-indigo-600 px-5 py-3"
        >
          <Text className="text-base font-semibold text-white">Add</Text>
        </Pressable>
      </View>

      <ExpenseList
        expenses={expenses}
        onMarkPaid={(expense) => markExpensePaid.mutate(expense)}
        onSelectExpense={(expense) => sheetRef.current?.present(expense)}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        isFetchingNextPage={isFetchingNextPage}
      />

      <ExpenseSheet
        ref={sheetRef}
        categories={categories}
        onSave={(input) => createExpense.mutateAsync(input)}
        onUpdate={(input) => updateExpense.mutateAsync(input)}
        onDelete={(expense) => deleteExpense.mutateAsync(expense.id)}
        onMarkPaid={(expense) => markExpensePaid.mutateAsync(expense)}
      />
    </SafeAreaView>
  );
}
