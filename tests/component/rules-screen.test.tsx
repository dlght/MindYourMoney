import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RulesScreen } from "@/features/rules/RulesScreen";
import type { Rule, CreateRuleInput, UpdateRuleInput } from "@/features/rules/types";
import type { ExpenseCategoryOption } from "@/features/expenses/types";

const ZERO_INSETS_METRICS = {
  frame: { x: 0, y: 0, width: 0, height: 0 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

jest.mock("@gorhom/bottom-sheet", () => {
  const ReactActual = require("react");
  const { View: RNView, TextInput: RNTextInput } = require("react-native");
  return {
    __esModule: true,
    BottomSheetModal: ReactActual.forwardRef(function MockBottomSheetModal(
      { children }: { children: React.ReactNode },
      ref: React.Ref<{ present: () => void; dismiss: () => void }>
    ) {
      ReactActual.useImperativeHandle(ref, () => ({
        present: jest.fn(),
        dismiss: jest.fn(),
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
  { id: "cat-subs", name: "Subscriptions", icon: "repeat", color: "purple" },
];

const BIG_EXPENSE_RULE: Rule = {
  id: "rule-1",
  user_id: "user-1",
  name: "Big expense ahead",
  enabled: true,
  is_default: true,
  is_grouped: false,
  min_amount: 200,
  category_ids: null,
  days_before: 5,
  repeat_days_before: 1,
  created_at: "2026-07-01T00:00:00.000Z",
};

const DUE_TOMORROW_RULE: Rule = {
  id: "rule-2",
  user_id: "user-1",
  name: "Due tomorrow",
  enabled: true,
  is_default: true,
  is_grouped: true,
  min_amount: null,
  category_ids: null,
  days_before: 1,
  repeat_days_before: null,
  created_at: "2026-07-01T00:00:01.000Z",
};

const CUSTOM_RULE: Rule = {
  id: "rule-3",
  user_id: "user-1",
  name: "Subscriptions heads-up",
  enabled: true,
  is_default: false,
  is_grouped: false,
  min_amount: null,
  category_ids: ["cat-subs"],
  days_before: 3,
  repeat_days_before: null,
  created_at: "2026-07-02T00:00:00.000Z",
};

async function renderScreen(
  overrides: Partial<React.ComponentProps<typeof RulesScreen>> = {}
) {
  const props: React.ComponentProps<typeof RulesScreen> = {
    rules: [BIG_EXPENSE_RULE, DUE_TOMORROW_RULE],
    categories: CATEGORIES,
    isError: false,
    onRetry: jest.fn(),
    onCreate: jest.fn().mockResolvedValue(CUSTOM_RULE),
    onUpdate: jest.fn().mockResolvedValue(undefined),
    onDelete: jest.fn().mockResolvedValue(undefined),
    hasNotificationPermission: true,
    ...overrides,
  };

  const result = await render(
    <SafeAreaProvider initialMetrics={ZERO_INSETS_METRICS}>
      <RulesScreen {...props} />
    </SafeAreaProvider>
  );

  return { props, ...result };
}

describe("RulesScreen — Scenario 1: default rules listed on first view", () => {
  it("shows both seeded default rules with their configuration", async () => {
    await renderScreen();

    expect(screen.getByText("Big expense ahead")).toBeTruthy();
    expect(screen.getByText("Due tomorrow")).toBeTruthy();
    expect(screen.getByText(/≥ €200.00 · 5 days before, \+1-day repeat · All categories/)).toBeTruthy();
  });
});

describe("RulesScreen — Scenario 6/7: edit and disable reconcile", () => {
  it("calls onUpdate with the disabled state when the enabled switch is toggled off", async () => {
    const onUpdate = jest.fn().mockResolvedValue(undefined);
    await renderScreen({ onUpdate });

    const toggle = screen.getByLabelText("Disable Big expense ahead");
    await fireEvent(toggle, "valueChange", false);

    expect(onUpdate).toHaveBeenCalledWith({ id: BIG_EXPENSE_RULE.id, enabled: false });
  });
});

describe("RulesScreen — Scenario 8: default rules can't be deleted", () => {
  it("does not render a delete button for a default rule, only the enable/disable switch", async () => {
    await renderScreen();

    expect(screen.queryByLabelText("Delete Big expense ahead")).toBeNull();
    expect(screen.queryByLabelText("Delete Due tomorrow")).toBeNull();
    expect(screen.getByLabelText("Disable Big expense ahead")).toBeTruthy();
  });
});

describe("RulesScreen — Scenario 9: custom rule create/delete", () => {
  it("renders a delete button for a custom (non-default) rule", async () => {
    await renderScreen({ rules: [BIG_EXPENSE_RULE, CUSTOM_RULE] });

    expect(screen.getByLabelText("Delete Subscriptions heads-up")).toBeTruthy();
  });

  it("calls onDelete after confirming deletion of a custom rule", async () => {
    const onDelete = jest.fn().mockResolvedValue(undefined);
    await renderScreen({ rules: [BIG_EXPENSE_RULE, CUSTOM_RULE], onDelete });

    await fireEvent.press(screen.getByLabelText("Delete Subscriptions heads-up"));
    // The row's own "Delete" label and the confirmation dialog's confirm
    // button both render the literal text "Delete" — the dialog's is the
    // one that appears later in the tree (rendered after the list).
    const deleteTexts = screen.getAllByText("Delete");
    await fireEvent.press(deleteTexts[deleteTexts.length - 1]);

    expect(onDelete).toHaveBeenCalledWith(CUSTOM_RULE);
  });

  it("calls onCreate with the entered fields when saving a new rule", async () => {
    const onCreate = jest.fn().mockResolvedValue(CUSTOM_RULE);
    await renderScreen({ onCreate });

    // "Add rule" is both the header button's label and the (always-mounted,
    // per the mocked bottom sheet) sheet's own title when in create mode —
    // the header button is the first match in the tree.
    await fireEvent.press(screen.getAllByText("Add rule")[0]);
    await fireEvent.changeText(screen.getByLabelText("Rule name"), "Groceries watch");
    await fireEvent.changeText(screen.getByLabelText("Amount threshold"), "50");
    await fireEvent.changeText(screen.getByLabelText("Days before due date"), "3");
    await fireEvent.press(screen.getByText("Save"));

    expect(onCreate).toHaveBeenCalledWith({
      name: "Groceries watch",
      min_amount: 50,
      category_ids: null,
      days_before: 3,
      repeat_days_before: null,
    });
  });
});

describe("RulesScreen — Scenario 11: notification permission banner", () => {
  it("shows the reminders-off banner when permission is denied", async () => {
    await renderScreen({ hasNotificationPermission: false });

    expect(
      screen.getByText(
        "Reminders are off — enable notifications in your device settings to get expense alerts."
      )
    ).toBeTruthy();
  });

  it("does not show the banner when permission is granted", async () => {
    await renderScreen({ hasNotificationPermission: true });

    expect(
      screen.queryByText(
        "Reminders are off — enable notifications in your device settings to get expense alerts."
      )
    ).toBeNull();
  });

  it("does not show the banner while permission status is still being checked", async () => {
    await renderScreen({ hasNotificationPermission: null });

    expect(
      screen.queryByText(
        "Reminders are off — enable notifications in your device settings to get expense alerts."
      )
    ).toBeNull();
  });
});

describe("RulesScreen — loading/error states", () => {
  it("shows a retry button when rules failed to load and nothing is cached", async () => {
    const onRetry = jest.fn();
    await renderScreen({ rules: undefined, isError: true, onRetry });

    await fireEvent.press(screen.getByText("Retry"));
    expect(onRetry).toHaveBeenCalled();
  });

  it("renders a blank screen (no crash) while rules are still loading", async () => {
    await renderScreen({ rules: undefined, isError: false });
    expect(screen.queryByText("Rules")).toBeNull();
  });
});
