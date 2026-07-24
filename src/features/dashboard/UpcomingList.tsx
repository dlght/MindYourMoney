import { Pressable, Text, View } from "react-native";
import type { UpcomingGroup } from "@/features/dashboard/types";
import type { Expense } from "@/features/expenses/types";

interface UpcomingListProps {
  groups: UpcomingGroup[];
  emptyMessage: string;
  onMarkPaid: (expense: Expense) => void;
}

export function UpcomingList({ groups, emptyMessage, onMarkPaid }: UpcomingListProps) {
  if (groups.length === 0) {
    return (
      <View className="items-center px-6 py-8">
        <Text className="text-center text-slate-600 dark:text-slate-400">{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View className="gap-4 px-4">
      {groups.map((group) => (
        <View key={group.isoDate} className="gap-2">
          <Text className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            {group.dateLabel}
          </Text>
          <View className="gap-2">
            {group.expenses.map((expense) => (
              <View
                key={expense.id}
                className="flex-row items-center justify-between rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-700"
              >
                <Text className="font-medium text-slate-900 dark:text-white">{expense.name}</Text>
                <View className="items-end gap-1">
                  <Text className="font-medium text-slate-900 dark:text-white">
                    {expense.amount.toFixed(2)} {expense.currency}
                  </Text>
                  <Pressable
                    onPress={() => onMarkPaid(expense)}
                    accessibilityRole="button"
                    accessibilityLabel={`Mark ${expense.name} as paid`}
                    className="rounded-full bg-green-600 px-3 py-1"
                  >
                    <Text className="text-xs font-medium text-white">Mark as paid</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
