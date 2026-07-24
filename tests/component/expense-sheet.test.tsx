import React, { useRef } from "react";
import { Pressable, Text } from "react-native";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ExpenseSheet, type ExpenseSheetHandle } from "@/features/expenses/ExpenseSheet";
import type { CreateExpenseInput, Expense, ExpenseCategoryOption, UpdateExpenseInput } from "@/features/expenses/types";

const ZERO_INSETS_METRICS = {
  frame: { x: 0, y: 0, width: 0, height: 0 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

// Exposed so tests can simulate the sheet's own dismiss() throwing (e.g. a
// gesture/animation glitch) independently of whether the save/delete
// request itself succeeded — see tasks.md T034.
const mockSheetControls = { dismissShouldThrow: false };

jest.mock("@gorhom/bottom-sheet", () => {
  const ReactActual = require("react");
  const { View: RNView, TextInput: RNTextInput } = require("react-native");
  return {
    __esModule: true,
    __mockSheetControls: mockSheetControls,
    BottomSheetModal: ReactActual.forwardRef(function MockBottomSheetModal(
      { children }: { children: React.ReactNode },
      ref: React.Ref<{ present: () => void; dismiss: () => void }>
    ) {
      ReactActual.useImperativeHandle(ref, () => ({
        present: jest.fn(),
        dismiss: () => {
          if (mockSheetControls.dismissShouldThrow) {
            throw new Error("dismiss failed (simulated)");
          }
        },
      }));
      return <RNView>{children}</RNView>;
    }),
    BottomSheetScrollView: ({ children, ...props }: { children: React.ReactNode }) => (
      <RNView {...props}>{children}</RNView>
    ),
    BottomSheetTextInput: (props: Record<string, unknown>) => <RNTextInput {...props} />,
    BottomSheetBackdrop: () => null,
  };
});

const CATEGORIES: ExpenseCategoryOption[] = [
  { id: "cat-housing", name: "Housing", icon: "house", color: "indigo" },
  { id: "cat-other", name: "Other", icon: "dots", color: "gray" },
];

const EXISTING_EXPENSE: Expense = {
  id: "exp-1",
  user_id: "user-1",
  category_id: "cat-housing",
  name: "Rent",
  amount: 850,
  currency: "EUR",
  due_date: "2026-08-01",
  recurrence: null,
  status: "planned",
  paid_at: null,
  rolled_from_id: null,
  notes: null,
  created_at: "2026-07-01T00:00:00.000Z",
};

const RECURRING_MONTHLY_EXPENSE: Expense = {
  ...EXISTING_EXPENSE,
  id: "exp-2",
  recurrence: "monthly",
  due_date: "2027-03-10",
};

// Opens the sheet the same way ExpenseList does: via the imperative handle,
// optionally passing an existing expense to enter edit-mode.
function Harness({
  onSave,
  onUpdate,
  onDelete,
  onMarkPaid = jest.fn(),
  openWith,
}: {
  onSave: (input: CreateExpenseInput) => Promise<Expense>;
  onUpdate: (input: UpdateExpenseInput) => Promise<unknown>;
  onDelete: (expense: Expense) => Promise<unknown>;
  onMarkPaid?: (expense: Expense) => Promise<unknown>;
  openWith?: Expense;
}) {
  const ref = useRef<ExpenseSheetHandle>(null);
  return (
    <SafeAreaProvider initialMetrics={ZERO_INSETS_METRICS}>
      <Pressable onPress={() => ref.current?.present(openWith)} accessibilityRole="button">
        <Text>Open</Text>
      </Pressable>
      <ExpenseSheet
        ref={ref}
        categories={CATEGORIES}
        onSave={onSave}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onMarkPaid={onMarkPaid}
      />
    </SafeAreaProvider>
  );
}

async function selectCategory(name: string) {
  await fireEvent.press(screen.getByLabelText("Select category"));
  await fireEvent.press(screen.getByText(name));
}

describe("ExpenseSheet (add mode, one-off expense)", () => {
  afterEach(() => {
    mockSheetControls.dismissShouldThrow = false;
  });

  it("rejects an empty name and a non-positive amount without calling onSave", async () => {
    const onSave = jest.fn();
    await render(<Harness onSave={onSave} onUpdate={jest.fn()} onDelete={jest.fn()} />);
    await fireEvent.press(screen.getByText("Open"));

    await fireEvent.changeText(screen.getByLabelText("Amount"), "0");
    await fireEvent.changeText(screen.getByLabelText("Due date"), "2026-08-01");
    await fireEvent.press(screen.getByText("Save"));

    expect(screen.getByText("Name is required.")).toBeTruthy();
    expect(screen.getByText("Amount must be a positive number.")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("defaults the category to Other when the user never picks one", async () => {
    const onSave = jest.fn();
    await render(<Harness onSave={onSave} onUpdate={jest.fn()} onDelete={jest.fn()} />);
    await fireEvent.press(screen.getByText("Open"));

    await fireEvent.changeText(screen.getByLabelText("Expense name"), "Rent");
    await fireEvent.changeText(screen.getByLabelText("Amount"), "850");
    await fireEvent.changeText(screen.getByLabelText("Due date"), "2026-08-01");
    await fireEvent.press(screen.getByText("Save"));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Rent", amount: 850, category_id: "cat-other" })
    );
  });

  it("opens the compact category picker and saves with the explicitly chosen category", async () => {
    const onSave = jest.fn();
    await render(<Harness onSave={onSave} onUpdate={jest.fn()} onDelete={jest.fn()} />);
    await fireEvent.press(screen.getByText("Open"));

    // Collapsed by default — the full category list isn't on screen until opened.
    expect(screen.queryByText("Housing")).toBeNull();

    await fireEvent.changeText(screen.getByLabelText("Expense name"), "Rent");
    await fireEvent.changeText(screen.getByLabelText("Amount"), "850");
    await fireEvent.changeText(screen.getByLabelText("Due date"), "2026-08-01");
    await selectCategory("Housing");
    await fireEvent.press(screen.getByText("Save"));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ category_id: "cat-housing" }));
  });

  it("shows an inline error and keeps the form's values when the save request fails", async () => {
    const onSave = jest.fn().mockRejectedValue(new Error("relation \"expenses\" does not exist"));
    await render(<Harness onSave={onSave} onUpdate={jest.fn()} onDelete={jest.fn()} />);
    await fireEvent.press(screen.getByText("Open"));

    await fireEvent.changeText(screen.getByLabelText("Expense name"), "Rent");
    await fireEvent.changeText(screen.getByLabelText("Amount"), "850");
    await fireEvent.changeText(screen.getByLabelText("Due date"), "2026-08-01");
    await fireEvent.press(screen.getByText("Save"));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText("Something went wrong saving this expense. Please try again.")
    ).toBeTruthy();
    // The form was not silently cleared — the user's input is still there to retry with.
    expect(screen.getByDisplayValue("Rent")).toBeTruthy();
    expect(screen.getByDisplayValue("850")).toBeTruthy();
  });

  it("never shows a save error when the save itself succeeds, even if closing the sheet afterward throws", async () => {
    mockSheetControls.dismissShouldThrow = true;
    const onSave = jest.fn().mockResolvedValue(undefined);
    await render(<Harness onSave={onSave} onUpdate={jest.fn()} onDelete={jest.fn()} />);
    await fireEvent.press(screen.getByText("Open"));

    await fireEvent.changeText(screen.getByLabelText("Expense name"), "Rent");
    await fireEvent.changeText(screen.getByLabelText("Amount"), "850");
    await fireEvent.changeText(screen.getByLabelText("Due date"), "2026-08-01");
    await fireEvent.press(screen.getByText("Save"));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByText("Something went wrong saving this expense. Please try again.")
    ).toBeNull();
  });
});

describe("ExpenseSheet (add mode, monthly/yearly recurrence)", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("requires only a day for monthly, and resolves it against the current year/month when the day hasn't passed yet", async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 15)); // Aug 15, 2026
    const onSave = jest.fn();
    await render(<Harness onSave={onSave} onUpdate={jest.fn()} onDelete={jest.fn()} />);
    await fireEvent.press(screen.getByText("Open"));

    await fireEvent.changeText(screen.getByLabelText("Expense name"), "Rent");
    await fireEvent.changeText(screen.getByLabelText("Amount"), "850");
    await fireEvent.press(screen.getByText("Monthly"));

    // The full free-text due-date field is gone once a recurrence is picked.
    expect(screen.queryByLabelText("Due date")).toBeNull();

    await fireEvent.changeText(screen.getByLabelText("Day of month"), "20");
    await selectCategory("Housing");
    await fireEvent.press(screen.getByText("Save"));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ due_date: "2026-08-20", recurrence: "monthly" })
    );
  });

  it("rolls a new monthly expense forward to next month when the chosen day has already passed this month (T035)", async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 15)); // Aug 15, 2026
    const onSave = jest.fn().mockResolvedValue({ id: "exp-new" });
    await render(<Harness onSave={onSave} onUpdate={jest.fn()} onDelete={jest.fn()} />);
    await fireEvent.press(screen.getByText("Open"));

    await fireEvent.changeText(screen.getByLabelText("Expense name"), "Rent");
    await fireEvent.changeText(screen.getByLabelText("Amount"), "850");
    await fireEvent.press(screen.getByText("Monthly"));
    await fireEvent.changeText(screen.getByLabelText("Day of month"), "5");
    await fireEvent.press(screen.getByText("Save"));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ due_date: "2026-09-05" }));
  });

  it("keeps the entered (past) date and marks it paid immediately when 'already paid' is checked (T035)", async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 15)); // Aug 15, 2026
    const createdExpense = { id: "exp-new", due_date: "2026-08-05" };
    const onSave = jest.fn().mockResolvedValue(createdExpense);
    const onMarkPaid = jest.fn().mockResolvedValue(undefined);
    await render(<Harness onSave={onSave} onUpdate={jest.fn()} onDelete={jest.fn()} onMarkPaid={onMarkPaid} />);
    await fireEvent.press(screen.getByText("Open"));

    await fireEvent.changeText(screen.getByLabelText("Expense name"), "Rent");
    await fireEvent.changeText(screen.getByLabelText("Amount"), "850");
    await fireEvent.press(screen.getByText("Monthly"));
    await fireEvent.changeText(screen.getByLabelText("Day of month"), "5");
    await fireEvent.press(screen.getByText("Already paid for this cycle — just track it"));
    await fireEvent.press(screen.getByText("Save"));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ due_date: "2026-08-05" }));
    expect(onMarkPaid).toHaveBeenCalledWith(createdExpense);
  });

  it("does not offer the 'already paid' option for a one-off (non-recurring) expense", async () => {
    await render(<Harness onSave={jest.fn()} onUpdate={jest.fn()} onDelete={jest.fn()} />);
    await fireEvent.press(screen.getByText("Open"));

    expect(screen.queryByText("Already paid for this cycle — just track it")).toBeNull();
  });

  it("requires a month and a day for yearly, and resolves them against the current year", async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 0, 10)); // Jan 10, 2026
    const onSave = jest.fn();
    await render(<Harness onSave={onSave} onUpdate={jest.fn()} onDelete={jest.fn()} />);
    await fireEvent.press(screen.getByText("Open"));

    await fireEvent.changeText(screen.getByLabelText("Expense name"), "Car insurance");
    await fireEvent.changeText(screen.getByLabelText("Amount"), "300");
    await fireEvent.press(screen.getByText("Yearly"));
    await fireEvent.changeText(screen.getByLabelText("Month"), "6");
    await fireEvent.changeText(screen.getByLabelText("Day of month"), "20");
    await fireEvent.press(screen.getByText("Save"));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ due_date: "2026-06-20", recurrence: "yearly" })
    );
  });

  it("rolls a new yearly expense forward to next year when the chosen month/day has already passed this year (T035)", async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 15)); // Aug 15, 2026
    const onSave = jest.fn();
    await render(<Harness onSave={onSave} onUpdate={jest.fn()} onDelete={jest.fn()} />);
    await fireEvent.press(screen.getByText("Open"));

    await fireEvent.changeText(screen.getByLabelText("Expense name"), "Car insurance");
    await fireEvent.changeText(screen.getByLabelText("Amount"), "300");
    await fireEvent.press(screen.getByText("Yearly"));
    await fireEvent.changeText(screen.getByLabelText("Month"), "1");
    await fireEvent.changeText(screen.getByLabelText("Day of month"), "10");
    await fireEvent.press(screen.getByText("Save"));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ due_date: "2027-01-10", recurrence: "yearly" })
    );
  });

  it("blocks save when the day (monthly) or month (yearly) is missing", async () => {
    const onSave = jest.fn();
    await render(<Harness onSave={onSave} onUpdate={jest.fn()} onDelete={jest.fn()} />);
    await fireEvent.press(screen.getByText("Open"));

    await fireEvent.changeText(screen.getByLabelText("Expense name"), "Rent");
    await fireEvent.changeText(screen.getByLabelText("Amount"), "850");
    await fireEvent.press(screen.getByText("Monthly"));
    await fireEvent.press(screen.getByText("Save"));

    expect(screen.getByText("Day must be between 1 and 31.")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText("Yearly"));
    await fireEvent.press(screen.getByText("Save"));

    expect(screen.getByText("Month must be between 1 and 12.")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe("ExpenseSheet (edit mode)", () => {
  it("pre-fills fields from the given expense and calls onUpdate with the changed values", async () => {
    const onUpdate = jest.fn();
    await render(
      <Harness onSave={jest.fn()} onUpdate={onUpdate} onDelete={jest.fn()} openWith={EXISTING_EXPENSE} />
    );
    await fireEvent.press(screen.getByText("Open"));

    expect(screen.getByDisplayValue("Rent")).toBeTruthy();
    expect(screen.getByDisplayValue("850")).toBeTruthy();
    expect(screen.getByDisplayValue("2026-08-01")).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText("Amount"), "900");
    await fireEvent.press(screen.getByText("Save"));

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "exp-1", name: "Rent", amount: 900 })
    );
  });

  it("pre-fills the day for an existing monthly expense and anchors edits to its own year/month, not today", async () => {
    const onUpdate = jest.fn();
    await render(
      <Harness onSave={jest.fn()} onUpdate={onUpdate} onDelete={jest.fn()} openWith={RECURRING_MONTHLY_EXPENSE} />
    );
    await fireEvent.press(screen.getByText("Open"));

    expect(screen.getByDisplayValue("10")).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText("Day of month"), "15");
    await fireEvent.press(screen.getByText("Save"));

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "exp-2", due_date: "2027-03-15" })
    );
  });

  it("requires confirmation before deleting, and only calls onDelete once confirmed", async () => {
    const onDelete = jest.fn();
    await render(
      <Harness onSave={jest.fn()} onUpdate={jest.fn()} onDelete={onDelete} openWith={EXISTING_EXPENSE} />
    );
    await fireEvent.press(screen.getByText("Open"));
    await fireEvent.press(screen.getByText("Delete expense"));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText('Delete "Rent"? This cannot be undone.')).toBeTruthy();

    await fireEvent.press(screen.getByText("Delete"));

    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: "exp-1" }));
  });

  it("cancelling the confirmation does not delete the expense", async () => {
    const onDelete = jest.fn();
    await render(
      <Harness onSave={jest.fn()} onUpdate={jest.fn()} onDelete={onDelete} openWith={EXISTING_EXPENSE} />
    );
    await fireEvent.press(screen.getByText("Open"));
    await fireEvent.press(screen.getByText("Delete expense"));
    await fireEvent.press(screen.getByText("Cancel"));

    expect(onDelete).not.toHaveBeenCalled();
  });

  it("shows an inline error when the delete request fails", async () => {
    const onDelete = jest.fn().mockRejectedValue(new Error("network error"));
    await render(
      <Harness onSave={jest.fn()} onUpdate={jest.fn()} onDelete={onDelete} openWith={EXISTING_EXPENSE} />
    );
    await fireEvent.press(screen.getByText("Open"));
    await fireEvent.press(screen.getByText("Delete expense"));
    await fireEvent.press(screen.getByText("Delete"));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText("Something went wrong deleting this expense. Please try again.")
    ).toBeTruthy();
  });
});
