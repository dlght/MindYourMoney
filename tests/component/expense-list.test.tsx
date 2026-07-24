import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ExpenseList } from "@/features/expenses/ExpenseList";
import type { Expense } from "@/features/expenses/types";

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: "exp-1",
    user_id: "user-1",
    category_id: "cat-1",
    name: "Rent",
    amount: 800,
    currency: "EUR",
    due_date: "2026-08-01",
    recurrence: null,
    status: "planned",
    paid_at: null,
    rolled_from_id: null,
    notes: null,
    created_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("ExpenseList pagination (F5, FR-014)", () => {
  it("calls onEndReached when the FlatList reports it's near the bottom", async () => {
    const onEndReached = jest.fn();
    await render(<ExpenseList expenses={[makeExpense()]} onEndReached={onEndReached} />);

    fireEvent(screen.getByTestId("expense-list"), "endReached");

    expect(onEndReached).toHaveBeenCalledTimes(1);
  });

  it("shows a footer loading indicator while fetching the next page", async () => {
    await render(<ExpenseList expenses={[makeExpense()]} isFetchingNextPage />);

    expect(screen.queryByTestId("expense-list-loading-more")).toBeTruthy();
  });

  it("does not show a footer loading indicator when not fetching the next page", async () => {
    await render(<ExpenseList expenses={[makeExpense()]} isFetchingNextPage={false} />);

    expect(screen.queryByTestId("expense-list-loading-more")).toBeNull();
  });
});
