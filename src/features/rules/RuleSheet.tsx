import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { ActivityIndicator, View, Text, Pressable, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { themeColors } from "@/theme/colors";
import { validateRuleForm, isRuleFormValid, type RuleFormErrors } from "@/features/rules/ruleValidation";
import type { CreateRuleInput, Rule, UpdateRuleInput } from "@/features/rules/types";
import type { ExpenseCategoryOption } from "@/features/expenses/types";

export interface RuleSheetHandle {
  // Omit `rule` to open in create-mode; pass an existing rule to open
  // pre-filled in edit-mode (FR-004), including the two seeded defaults.
  present: (rule?: Rule) => void;
  dismiss: () => void;
}

interface RuleSheetProps {
  categories: ExpenseCategoryOption[];
  onSave: (input: CreateRuleInput) => Promise<Rule>;
  onUpdate: (input: UpdateRuleInput) => Promise<unknown>;
}

const SUBMIT_ERROR_MESSAGE = "Something went wrong saving this rule. Please try again.";

export const RuleSheet = forwardRef<RuleSheetHandle, RuleSheetProps>(function RuleSheet(
  { categories, onSave, onUpdate },
  ref
) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const colorScheme = useColorScheme() ?? "light";
  const colors = themeColors[colorScheme];
  const insets = useSafeAreaInsets();

  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [name, setName] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [daysBefore, setDaysBefore] = useState("");
  const [repeatDaysBefore, setRepeatDaysBefore] = useState("");
  const [categoryIds, setCategoryIds] = useState<string[] | null>(null);
  const [categoryPickerExpanded, setCategoryPickerExpanded] = useState(false);
  const [errors, setErrors] = useState<RuleFormErrors>({});
  const [saving, setSaving] = useState(false);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.6}
        pressBehavior="close"
      />
    ),
    []
  );

  const reset = () => {
    setEditingRule(null);
    setName("");
    setMinAmount("");
    setDaysBefore("");
    setRepeatDaysBefore("");
    setCategoryIds(null);
    setCategoryPickerExpanded(false);
    setErrors({});
  };

  useImperativeHandle(ref, () => ({
    present: (rule) => {
      setEditingRule(rule ?? null);
      if (rule) {
        setName(rule.name);
        setMinAmount(rule.min_amount === null ? "" : String(rule.min_amount));
        setDaysBefore(String(rule.days_before));
        setRepeatDaysBefore(rule.repeat_days_before === null ? "" : String(rule.repeat_days_before));
        setCategoryIds(rule.category_ids);
      } else {
        setName("");
        setMinAmount("");
        setDaysBefore("");
        setRepeatDaysBefore("");
        setCategoryIds(null);
      }
      setCategoryPickerExpanded(false);
      setErrors({});
      sheetRef.current?.present();
    },
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const toggleCategory = (categoryId: string) => {
    setCategoryIds((current) => {
      const base = current ?? [];
      return base.includes(categoryId)
        ? base.filter((id) => id !== categoryId)
        : [...base, categoryId];
    });
  };

  const handleSave = async () => {
    const validationErrors = validateRuleForm({ name, minAmount, daysBefore, repeatDaysBefore });
    if (!isRuleFormValid(validationErrors)) {
      setErrors(validationErrors);
      return;
    }

    const payload = {
      name: name.trim(),
      min_amount: minAmount.trim() ? Number(minAmount) : null,
      category_ids: categoryIds,
      days_before: Number(daysBefore),
      repeat_days_before: repeatDaysBefore.trim() ? Number(repeatDaysBefore) : null,
    };

    setSaving(true);
    setErrors({});
    let saveSucceeded = false;
    try {
      if (editingRule) {
        await onUpdate({ id: editingRule.id, ...payload });
      } else {
        await onSave(payload);
      }
      saveSucceeded = true;
    } catch {
      setErrors({ submit: SUBMIT_ERROR_MESSAGE });
    } finally {
      setSaving(false);
    }

    if (saveSucceeded) {
      try {
        reset();
        sheetRef.current?.dismiss();
      } catch {
        // The save already succeeded — a glitch closing the sheet must
        // never surface as (or be mistaken for) a failed save.
      }
    }
  };

  const categoryFilterLabel =
    categoryIds === null
      ? "All categories"
      : categoryIds.length === 0
        ? "No categories selected"
        : categories
            .filter((category) => categoryIds.includes(category.id))
            .map((category) => category.name)
            .join(", ");

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={["75%"]}
      topInset={insets.top}
      onDismiss={reset}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backgroundStyle={{ backgroundColor: colors.background }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
      backdropComponent={renderBackdrop}
    >
      <BottomSheetScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 8,
          paddingBottom: 32 + insets.bottom,
          gap: 16,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-row items-center justify-between">
          <Text className="text-xl font-semibold text-slate-900 dark:text-white">
            {editingRule ? "Edit rule" : "Add rule"}
          </Text>
          <Pressable
            onPress={() => sheetRef.current?.dismiss()}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={12}
          >
            <Text className="text-2xl text-slate-500 dark:text-slate-400">×</Text>
          </Pressable>
        </View>

        <View className="gap-1">
          <BottomSheetTextInput
            value={name}
            onChangeText={setName}
            placeholder="Rule name"
            placeholderTextColor="#94a3b8"
            style={inputStyle(colors)}
            accessibilityLabel="Rule name"
          />
          {errors.name ? <Text className="text-red-600 dark:text-red-400">{errors.name}</Text> : null}
        </View>

        <View className="gap-1">
          <Text className="text-slate-600 dark:text-slate-400">Amount threshold (blank = any amount)</Text>
          <BottomSheetTextInput
            value={minAmount}
            onChangeText={setMinAmount}
            placeholder="Any amount"
            placeholderTextColor="#94a3b8"
            keyboardType="decimal-pad"
            style={inputStyle(colors)}
            accessibilityLabel="Amount threshold"
          />
          {errors.minAmount ? <Text className="text-red-600 dark:text-red-400">{errors.minAmount}</Text> : null}
        </View>

        <View className="gap-1">
          <Text className="text-slate-600 dark:text-slate-400">Days before due date</Text>
          <BottomSheetTextInput
            value={daysBefore}
            onChangeText={setDaysBefore}
            placeholder="e.g. 5"
            placeholderTextColor="#94a3b8"
            keyboardType="number-pad"
            style={inputStyle(colors)}
            accessibilityLabel="Days before due date"
          />
          {errors.daysBefore ? <Text className="text-red-600 dark:text-red-400">{errors.daysBefore}</Text> : null}
        </View>

        <View className="gap-1">
          <Text className="text-slate-600 dark:text-slate-400">
            Second reminder, days before (optional, blank = none)
          </Text>
          <BottomSheetTextInput
            value={repeatDaysBefore}
            onChangeText={setRepeatDaysBefore}
            placeholder="No second reminder"
            placeholderTextColor="#94a3b8"
            keyboardType="number-pad"
            style={inputStyle(colors)}
            accessibilityLabel="Second reminder days before"
          />
          {errors.repeatDaysBefore ? (
            <Text className="text-red-600 dark:text-red-400">{errors.repeatDaysBefore}</Text>
          ) : null}
        </View>

        <View className="gap-2">
          <Text className="text-slate-600 dark:text-slate-400">Categories</Text>
          <Pressable
            onPress={() => setCategoryPickerExpanded((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel="Select categories"
            accessibilityState={{ expanded: categoryPickerExpanded }}
            className="flex-row items-center justify-between rounded-lg border border-slate-300 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800"
          >
            <Text className="text-slate-900 dark:text-white">{categoryFilterLabel}</Text>
            <Text className="text-slate-500 dark:text-slate-400">{categoryPickerExpanded ? "︿" : "⌄"}</Text>
          </Pressable>

          {categoryPickerExpanded ? (
            <View className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
              <Pressable
                onPress={() => setCategoryIds(null)}
                accessibilityRole="button"
                accessibilityState={{ selected: categoryIds === null }}
                className={`px-4 py-3 ${
                  categoryIds === null ? "bg-indigo-50 dark:bg-indigo-950" : "bg-white dark:bg-slate-800"
                }`}
              >
                <Text
                  className={
                    categoryIds === null
                      ? "font-medium text-indigo-600 dark:text-indigo-400"
                      : "text-slate-900 dark:text-white"
                  }
                >
                  All categories
                </Text>
              </Pressable>
              {categories.map((category) => {
                const selected = categoryIds !== null && categoryIds.includes(category.id);
                return (
                  <Pressable
                    key={category.id}
                    onPress={() => toggleCategory(category.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    className={`border-t border-slate-200 px-4 py-3 dark:border-slate-700 ${
                      selected ? "bg-indigo-50 dark:bg-indigo-950" : "bg-white dark:bg-slate-800"
                    }`}
                  >
                    <Text
                      className={
                        selected
                          ? "font-medium text-indigo-600 dark:text-indigo-400"
                          : "text-slate-900 dark:text-white"
                      }
                    >
                      {category.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>

        {errors.submit ? <Text className="text-red-600 dark:text-red-400">{errors.submit}</Text> : null}

        <Pressable
          onPress={handleSave}
          disabled={saving}
          accessibilityRole="button"
          className="items-center rounded-lg bg-indigo-600 px-4 py-3 disabled:opacity-60"
        >
          {saving ? <ActivityIndicator color="#ffffff" /> : <Text className="font-medium text-white">Save</Text>}
        </Pressable>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

function inputStyle(colors: { border: string; text: string }) {
  return {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: colors.text,
  };
}
