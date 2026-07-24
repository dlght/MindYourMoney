import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from "react";
import { ActivityIndicator, View, Text, Pressable, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CategoryPicker } from "@/features/expenses/CategoryPicker";
import { themeColors } from "@/theme/colors";
import {
  validateExpenseForm,
  isExpenseFormValid,
  type ExpenseFormErrors,
} from "@/features/expenses/validation";
import { getTodayIso, nextOccurrence, resolveMonthlyDueDate, resolveYearlyDueDate } from "@/features/expenses/recurrence";
import type {
  CreateExpenseInput,
  Expense,
  ExpenseCategoryOption,
  ExpenseRecurrence,
  UpdateExpenseInput,
} from "@/features/expenses/types";

export interface ExpenseSheetHandle {
  // Omit `expense` (or pass undefined) to open in add-mode; pass an
  // existing expense to open pre-filled in edit-mode (US2).
  present: (expense?: Expense) => void;
  dismiss: () => void;
}

interface ExpenseSheetProps {
  categories: ExpenseCategoryOption[];
  // Promise-returning (backed by TanStack Query's mutateAsync in the
  // caller) so the sheet can wait for the real result before closing —
  // see research.md #5 / tasks.md T029. onSave resolves with the created
  // row so the "already paid" flow (tasks.md T035) can immediately mark it
  // paid without a second fetch.
  onSave: (input: CreateExpenseInput) => Promise<Expense>;
  onUpdate: (input: UpdateExpenseInput) => Promise<unknown>;
  onDelete: (expense: Expense) => Promise<unknown>;
  // Reused as-is from the Home/Add mark-as-paid action (research.md #6 of
  // F3) to back the "already paid" checkbox below — see T035.
  onMarkPaid: (expense: Expense) => Promise<unknown>;
}

const RECURRENCE_OPTIONS: { label: string; value: ExpenseRecurrence }[] = [
  { label: "None", value: null },
  { label: "Monthly", value: "monthly" },
  { label: "Yearly", value: "yearly" },
];

const SUBMIT_ERROR_MESSAGE = "Something went wrong saving this expense. Please try again.";
const DELETE_ERROR_MESSAGE = "Something went wrong deleting this expense. Please try again.";

// Single sheet handles both add-mode (US1) and edit-mode (US2): the form
// fields are identical, only the initial values, the save action, and the
// presence of a delete button differ based on whether `editingExpense` is
// set.
export const ExpenseSheet = forwardRef<ExpenseSheetHandle, ExpenseSheetProps>(
  function ExpenseSheet({ categories, onSave, onUpdate, onDelete, onMarkPaid }, ref) {
    const sheetRef = useRef<BottomSheetModal>(null);
    const colorScheme = useColorScheme() ?? "light";
    const colors = themeColors[colorScheme];
    const insets = useSafeAreaInsets();
    // FR-003: the sheet pre-selects "Other" so an untouched category field
    // still submits a valid category_id, not just leaving it to the API's
    // own fallback (expensesApi.createExpense) to catch.
    const defaultCategory = useMemo(
      () => categories.find((category) => category.name === "Other") ?? categories[0],
      [categories]
    );

    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const [name, setName] = useState("");
    const [amount, setAmount] = useState("");
    const [categoryId, setCategoryId] = useState<string | undefined>(defaultCategory?.id);
    const [recurrence, setRecurrence] = useState<ExpenseRecurrence>(null);
    // Only relevant when recurrence is null (a one-off expense).
    const [dueDate, setDueDate] = useState("");
    // Only relevant when recurrence is "monthly" or "yearly".
    const [day, setDay] = useState("");
    // Only relevant when recurrence is "yearly".
    const [month, setMonth] = useState("");
    // Anchors day/month back to a concrete due_date: the expense's existing
    // year(+month) when editing, so nudging just the day/month never
    // silently shifts an already-scheduled year; the current year(+month)
    // when creating one from scratch.
    const [baseYear, setBaseYear] = useState(() => new Date().getFullYear());
    const [baseMonth, setBaseMonth] = useState(() => new Date().getMonth() + 1);
    // Only offered when creating a new monthly/yearly expense (T035): opts
    // out of the default next-occurrence roll-forward below, so the exact
    // entered day/month is kept even if it falls in the current, already-
    // passed cycle, and immediately records that cycle as paid.
    const [alreadyPaidOnCreate, setAlreadyPaidOnCreate] = useState(false);
    const [errors, setErrors] = useState<ExpenseFormErrors>({});
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

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

    useImperativeHandle(ref, () => ({
      present: (expense) => {
        setEditingExpense(expense ?? null);
        if (expense) {
          const [year, expenseMonth, expenseDay] = expense.due_date.split("-").map(Number);
          setName(expense.name);
          setAmount(String(expense.amount));
          setCategoryId(expense.category_id);
          setRecurrence(expense.recurrence);
          setDueDate(expense.due_date);
          setDay(String(expenseDay));
          setMonth(String(expenseMonth));
          setBaseYear(year);
          setBaseMonth(expenseMonth);
        } else {
          const now = new Date();
          setName("");
          setAmount("");
          setCategoryId(defaultCategory?.id);
          setRecurrence(null);
          setDueDate("");
          setDay("");
          setMonth("");
          setBaseYear(now.getFullYear());
          setBaseMonth(now.getMonth() + 1);
        }
        setAlreadyPaidOnCreate(false);
        setErrors({});
        sheetRef.current?.present();
      },
      dismiss: () => sheetRef.current?.dismiss(),
    }));

    const reset = () => {
      const now = new Date();
      setEditingExpense(null);
      setName("");
      setAmount("");
      setCategoryId(defaultCategory?.id);
      setRecurrence(null);
      setDueDate("");
      setDay("");
      setMonth("");
      setBaseYear(now.getFullYear());
      setBaseMonth(now.getMonth() + 1);
      setAlreadyPaidOnCreate(false);
      setErrors({});
      setConfirmingDelete(false);
    };

    const handleSave = async () => {
      const validationErrors = validateExpenseForm({ name, amount, recurrence, dueDate, day, month });
      if (!isExpenseFormValid(validationErrors)) {
        setErrors(validationErrors);
        return;
      }

      const resolvedCategoryId = categoryId ?? defaultCategory?.id;
      const isNewRecurringExpense = !editingExpense && recurrence !== null;
      let resolvedDueDate =
        recurrence === "monthly"
          ? resolveMonthlyDueDate(Number(day), baseYear, baseMonth)
          : recurrence === "yearly"
            ? resolveYearlyDueDate(Number(month), Number(day), baseYear)
            : dueDate.trim();

      // A brand-new recurring expense defaults to its next upcoming
      // occurrence, not a cycle that's already passed this month/year —
      // e.g. picking day 5 on the 20th used to schedule a due date 15 days
      // in the past. Skipped when the user opts in via "already paid",
      // which intentionally keeps the entered (possibly past) date so it
      // can be recorded as history (T035).
      if (isNewRecurringExpense && !alreadyPaidOnCreate && resolvedDueDate < getTodayIso()) {
        resolvedDueDate = nextOccurrence(resolvedDueDate, recurrence as "monthly" | "yearly");
      }

      const payload = {
        name: name.trim(),
        amount: Number(amount),
        due_date: resolvedDueDate,
        category_id: resolvedCategoryId,
        recurrence,
      };

      setSaving(true);
      setErrors({});
      // Only the network call itself is allowed to produce a "save failed"
      // error. reset()/dismiss() run afterwards, unconditionally on success,
      // outside this try — otherwise an unrelated exception from either of
      // those (e.g. dismissing the sheet while the keyboard is still
      // transitioning) gets misreported as a failed save even though the
      // data was already written (tasks.md T034).
      let saveSucceeded = false;
      try {
        if (editingExpense) {
          await onUpdate({ id: editingExpense.id, ...payload });
        } else {
          const created = await onSave(payload);
          if (isNewRecurringExpense && alreadyPaidOnCreate) {
            // Records this cycle as paid immediately and rolls it forward
            // to the next real occurrence, via the same atomic RPC-backed
            // mutation the Home/Add "mark as paid" action already uses
            // (F3 research.md #6) — no separate paid/history logic needed.
            await onMarkPaid(created);
          }
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

    const handleConfirmDelete = async () => {
      if (!editingExpense) {
        setConfirmingDelete(false);
        return;
      }

      setDeleting(true);
      let deleteSucceeded = false;
      try {
        await onDelete(editingExpense);
        deleteSucceeded = true;
      } catch {
        setErrors({ submit: DELETE_ERROR_MESSAGE });
      } finally {
        setDeleting(false);
      }

      setConfirmingDelete(false);
      if (deleteSucceeded) {
        try {
          reset();
          sheetRef.current?.dismiss();
        } catch {
          // The delete already succeeded — a glitch closing the sheet must
          // never surface as (or be mistaken for) a failed delete.
        }
      }
    };

    return (
      <>
        <BottomSheetModal
          ref={sheetRef}
          snapPoints={["90%"]}
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
                {editingExpense ? "Edit expense" : "Add expense"}
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

            {/* Order matches how the user actually decides: category, then
                what/how-much, then how-often, then (only if needed) the
                specific date. */}
            <CategoryPicker categories={categories} selectedId={categoryId} onSelect={setCategoryId} />

            <View className="gap-1">
              <BottomSheetTextInput
                value={name}
                onChangeText={setName}
                placeholder="Name"
                placeholderTextColor="#94a3b8"
                style={inputStyle(colors)}
                accessibilityLabel="Expense name"
              />
              {errors.name ? <Text className="text-red-600 dark:text-red-400">{errors.name}</Text> : null}
            </View>

            <View className="gap-1">
              <BottomSheetTextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="Amount"
                placeholderTextColor="#94a3b8"
                keyboardType="decimal-pad"
                style={inputStyle(colors)}
                accessibilityLabel="Amount"
              />
              {errors.amount ? <Text className="text-red-600 dark:text-red-400">{errors.amount}</Text> : null}
            </View>

            <View className="gap-2">
              <Text className="text-slate-600 dark:text-slate-400">Recurrence</Text>
              <View className="flex-row gap-2">
                {RECURRENCE_OPTIONS.map((option) => (
                  <Pressable
                    key={option.label}
                    onPress={() => setRecurrence(option.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: recurrence === option.value }}
                    className={`rounded-full border px-3 py-2 ${
                      recurrence === option.value
                        ? "border-indigo-600 bg-indigo-600"
                        : "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800"
                    }`}
                  >
                    <Text className={recurrence === option.value ? "text-white" : "text-slate-900 dark:text-white"}>
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {recurrence === null ? (
              <View className="gap-1">
                <BottomSheetTextInput
                  value={dueDate}
                  onChangeText={setDueDate}
                  placeholder="Due date (YYYY-MM-DD)"
                  placeholderTextColor="#94a3b8"
                  style={inputStyle(colors)}
                  accessibilityLabel="Due date"
                />
                {errors.dueDate ? <Text className="text-red-600 dark:text-red-400">{errors.dueDate}</Text> : null}
              </View>
            ) : recurrence === "monthly" ? (
              <View className="gap-1">
                <BottomSheetTextInput
                  value={day}
                  onChangeText={setDay}
                  placeholder="Day of month (1-31)"
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                  style={inputStyle(colors)}
                  accessibilityLabel="Day of month"
                />
                {errors.day ? <Text className="text-red-600 dark:text-red-400">{errors.day}</Text> : null}
              </View>
            ) : (
              <View className="flex-row gap-2">
                <View className="flex-1 gap-1">
                  <BottomSheetTextInput
                    value={month}
                    onChangeText={setMonth}
                    placeholder="Month (1-12)"
                    placeholderTextColor="#94a3b8"
                    keyboardType="number-pad"
                    style={inputStyle(colors)}
                    accessibilityLabel="Month"
                  />
                  {errors.month ? <Text className="text-red-600 dark:text-red-400">{errors.month}</Text> : null}
                </View>
                <View className="flex-1 gap-1">
                  <BottomSheetTextInput
                    value={day}
                    onChangeText={setDay}
                    placeholder="Day (1-31)"
                    placeholderTextColor="#94a3b8"
                    keyboardType="number-pad"
                    style={inputStyle(colors)}
                    accessibilityLabel="Day of month"
                  />
                  {errors.day ? <Text className="text-red-600 dark:text-red-400">{errors.day}</Text> : null}
                </View>
              </View>
            )}

            {!editingExpense && recurrence !== null ? (
              <View className="gap-1">
                <Pressable
                  onPress={() => setAlreadyPaidOnCreate((value) => !value)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: alreadyPaidOnCreate }}
                  accessibilityLabel="Already paid for this cycle"
                  className="flex-row items-center gap-2"
                >
                  <View
                    className={`h-5 w-5 items-center justify-center rounded border ${
                      alreadyPaidOnCreate
                        ? "border-indigo-600 bg-indigo-600"
                        : "border-slate-300 dark:border-slate-600"
                    }`}
                  >
                    {alreadyPaidOnCreate ? <Text className="text-xs font-bold text-white">✓</Text> : null}
                  </View>
                  <Text className="flex-1 text-slate-700 dark:text-slate-300">
                    Already paid for this cycle — just track it
                  </Text>
                </Pressable>
                {alreadyPaidOnCreate ? (
                  <Text className="text-xs text-slate-500 dark:text-slate-400">
                    This entry will be recorded as already paid, and the next {recurrence} due date will be
                    scheduled automatically.
                  </Text>
                ) : null}
              </View>
            ) : null}

            {errors.submit ? <Text className="text-red-600 dark:text-red-400">{errors.submit}</Text> : null}

            <Pressable
              onPress={handleSave}
              disabled={saving}
              accessibilityRole="button"
              className="items-center rounded-lg bg-indigo-600 px-4 py-3 disabled:opacity-60"
            >
              {saving ? <ActivityIndicator color="#ffffff" /> : <Text className="font-medium text-white">Save</Text>}
            </Pressable>

            {editingExpense ? (
              <Pressable
                onPress={() => setConfirmingDelete(true)}
                disabled={deleting}
                accessibilityRole="button"
                className="items-center rounded-lg border border-red-600 px-4 py-3 disabled:opacity-60"
              >
                <Text className="font-medium text-red-600">Delete expense</Text>
              </Pressable>
            ) : null}
          </BottomSheetScrollView>
        </BottomSheetModal>

        <ConfirmDialog
          visible={confirmingDelete}
          title="Delete expense"
          message={editingExpense ? `Delete "${editingExpense.name}"? This cannot be undone.` : ""}
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      </>
    );
  }
);

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
