import { useRef, useState } from "react";
import { FlatList, Pressable, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { RuleSheet, type RuleSheetHandle } from "@/features/rules/RuleSheet";
import type { CreateRuleInput, Rule, UpdateRuleInput } from "@/features/rules/types";
import type { ExpenseCategoryOption } from "@/features/expenses/types";

interface RulesScreenProps {
  // undefined = no successful fetch yet; see DashboardScreen for the same
  // convention (F3).
  rules: Rule[] | undefined;
  categories: ExpenseCategoryOption[];
  isError: boolean;
  onRetry: () => void;
  onCreate: (input: CreateRuleInput) => Promise<Rule>;
  onUpdate: (input: UpdateRuleInput) => Promise<unknown>;
  onDelete: (rule: Rule) => Promise<unknown>;
  // null = still checking; the banner only ever renders once we know for
  // sure permission is denied (FR-014).
  hasNotificationPermission: boolean | null;
}

function summarizeRule(rule: Rule, categories: ExpenseCategoryOption[]): string {
  const amountPart = rule.min_amount === null ? "Any amount" : `≥ €${rule.min_amount.toFixed(2)}`;
  const timingPart =
    rule.repeat_days_before === null
      ? `${rule.days_before} days before`
      : `${rule.days_before} days before, +${rule.repeat_days_before}-day repeat`;
  const categoryPart =
    rule.category_ids === null
      ? "All categories"
      : rule.category_ids.length === 0
        ? "No categories"
        : categories
            .filter((category) => rule.category_ids!.includes(category.id))
            .map((category) => category.name)
            .join(", ");
  return `${amountPart} · ${timingPart} · ${categoryPart}`;
}

export function RulesScreen({
  rules,
  categories,
  isError,
  onRetry,
  onCreate,
  onUpdate,
  onDelete,
  hasNotificationPermission,
}: RulesScreenProps) {
  const sheetRef = useRef<RuleSheetHandle>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Rule | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleConfirmDelete = async () => {
    if (!deleteCandidate) return;
    try {
      await onDelete(deleteCandidate);
      setDeleteError(null);
    } catch {
      setDeleteError("Something went wrong deleting this rule. Please try again.");
    } finally {
      setDeleteCandidate(null);
    }
  };

  if (!rules) {
    if (isError) {
      return (
        <SafeAreaView
          edges={["top"]}
          className="flex-1 items-center justify-center gap-4 bg-white px-6 dark:bg-slate-900"
        >
          <Text className="text-center text-slate-600 dark:text-slate-400">
            Something went wrong loading your rules.
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

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-white dark:bg-slate-900">
      <View className="flex-row items-center justify-between px-6 py-4">
        <Text className="text-xl font-semibold text-slate-900 dark:text-white">Rules</Text>
        <Pressable
          onPress={() => sheetRef.current?.present()}
          accessibilityRole="button"
          className="rounded-lg bg-indigo-600 px-4 py-2"
        >
          <Text className="font-medium text-white">Add rule</Text>
        </Pressable>
      </View>

      {hasNotificationPermission === false ? (
        <View className="mx-6 mb-4 rounded-lg border border-amber-400 bg-amber-50 px-4 py-3 dark:border-amber-600 dark:bg-amber-950">
          <Text className="text-amber-900 dark:text-amber-200">
            Reminders are off — enable notifications in your device settings to get expense alerts.
          </Text>
        </View>
      ) : null}

      {deleteError ? (
        <View className="mx-6 mb-4">
          <Text className="text-red-600 dark:text-red-400">{deleteError}</Text>
        </View>
      ) : null}

      <FlatList
        data={rules}
        keyExtractor={(rule) => rule.id}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <View className="rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-700">
            <Pressable
              onPress={() => sheetRef.current?.present(item)}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${item.name}`}
            >
              <Text className="font-medium text-slate-900 dark:text-white">{item.name}</Text>
              <Text className="text-sm text-slate-600 dark:text-slate-400">
                {summarizeRule(item, categories)}
              </Text>
            </Pressable>
            <View className="mt-2 flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Switch
                  value={item.enabled}
                  onValueChange={(enabled) => {
                    onUpdate({ id: item.id, enabled });
                  }}
                  accessibilityLabel={`${item.enabled ? "Disable" : "Enable"} ${item.name}`}
                />
                <Text className="text-slate-600 dark:text-slate-400">
                  {item.enabled ? "Enabled" : "Disabled"}
                </Text>
              </View>
              {item.is_default ? null : (
                <Pressable
                  onPress={() => setDeleteCandidate(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${item.name}`}
                >
                  <Text className="font-medium text-red-600 dark:text-red-400">Delete</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
      />

      <RuleSheet ref={sheetRef} categories={categories} onSave={onCreate} onUpdate={onUpdate} />

      <ConfirmDialog
        visible={deleteCandidate !== null}
        title="Delete rule"
        message={deleteCandidate ? `Delete "${deleteCandidate.name}"? This cannot be undone.` : ""}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteCandidate(null)}
      />
    </SafeAreaView>
  );
}
