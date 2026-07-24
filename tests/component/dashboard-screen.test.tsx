import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { DashboardScreen } from "@/features/dashboard/DashboardScreen";
import type { Expense } from "@/features/expenses/types";

let nextId = 1;

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  const id = `exp-${nextId++}`;
  return {
    id,
    user_id: "user-1",
    category_id: "cat-1",
    name: "Expense",
    amount: 100,
    currency: "EUR",
    due_date: "2026-08-20",
    recurrence: null,
    status: "planned",
    paid_at: null,
    rolled_from_id: null,
    notes: null,
    created_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

const TODAY = "2026-08-15";

describe("DashboardScreen — next-30-days list (US1)", () => {
  it("renders upcoming expenses grouped under a date heading, with 'Today' for today's group", async () => {
    const todayExpense = makeExpense({ name: "Phone bill", due_date: TODAY });
    const laterExpense = makeExpense({ name: "Rent", due_date: "2026-08-20" });

    await render(
      <DashboardScreen
        expenses={[todayExpense, laterExpense]}
        isError={false}
        onRetry={jest.fn()}
        onMarkPaid={jest.fn()}
        todayIso={TODAY}
      />
    );

    expect(screen.getByText("Today")).toBeTruthy();
    // "Phone bill" also wins the biggest-upcoming tie-break (same amount as
    // Rent, but due sooner), so it legitimately renders in both the list and
    // the biggest-expense card.
    expect(screen.getAllByText("Phone bill").length).toBeGreaterThan(0);
    expect(screen.getByText("Rent")).toBeTruthy();
  });

  it("excludes paid and skipped expenses from the list", async () => {
    const planned = makeExpense({ name: "Planned one", due_date: "2026-08-20", status: "planned" });
    const paid = makeExpense({ name: "Paid one", due_date: "2026-08-20", status: "paid" });

    await render(
      <DashboardScreen
        expenses={[planned, paid]}
        isError={false}
        onRetry={jest.fn()}
        onMarkPaid={jest.fn()}
        todayIso={TODAY}
      />
    );

    // Also the only planned expense in window, so it's the biggest-upcoming
    // winner too and legitimately renders in both places.
    expect(screen.getAllByText("Planned one").length).toBeGreaterThan(0);
    expect(screen.queryByText("Paid one")).toBeNull();
  });

  it("shows a brand-new-account empty state when there are zero expenses at all", async () => {
    await render(
      <DashboardScreen expenses={[]} isError={false} onRetry={jest.fn()} onMarkPaid={jest.fn()} todayIso={TODAY} />
    );

    expect(screen.getByText("No expenses yet. Add one from the Add tab to get started.")).toBeTruthy();
  });

  it("shows a distinct empty state when expenses exist but none are due in the next 30 days", async () => {
    const farOut = makeExpense({ due_date: "2026-12-01" });

    await render(
      <DashboardScreen
        expenses={[farOut]}
        isError={false}
        onRetry={jest.fn()}
        onMarkPaid={jest.fn()}
        todayIso={TODAY}
      />
    );

    expect(screen.getByText("Nothing due in the next 30 days.")).toBeTruthy();
  });

  it("calls onMarkPaid with the tapped expense", async () => {
    const onMarkPaid = jest.fn();
    const expense = makeExpense({ name: "Internet", due_date: "2026-08-20" });

    await render(
      <DashboardScreen
        expenses={[expense]}
        isError={false}
        onRetry={jest.fn()}
        onMarkPaid={onMarkPaid}
        todayIso={TODAY}
      />
    );

    await fireEvent.press(screen.getByLabelText("Mark Internet as paid"));

    expect(onMarkPaid).toHaveBeenCalledWith(expect.objectContaining({ name: "Internet" }));
  });

  it("renders the last-known expenses when offline (a background error occurred but cached data exists)", async () => {
    const expense = makeExpense({ name: "Cached expense", due_date: "2026-08-20" });

    await render(
      <DashboardScreen
        expenses={[expense]}
        isError={true}
        onRetry={jest.fn()}
        onMarkPaid={jest.fn()}
        todayIso={TODAY}
      />
    );

    expect(screen.getAllByText("Cached expense").length).toBeGreaterThan(0);
    expect(screen.queryByText("Something went wrong loading your expenses.")).toBeNull();
  });

  it("shows a retry-able error state when there is no cached data and the fetch failed", async () => {
    const onRetry = jest.fn();

    await render(
      <DashboardScreen expenses={undefined} isError={true} onRetry={onRetry} onMarkPaid={jest.fn()} todayIso={TODAY} />
    );

    expect(screen.getByText("Something went wrong loading your expenses.")).toBeTruthy();

    await fireEvent.press(screen.getByText("Retry"));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe("DashboardScreen — upcoming total (US2)", () => {
  it("displays the exact sum of the planned expenses shown in the next-30-days list", async () => {
    const a = makeExpense({ due_date: "2026-08-18", amount: 100 });
    const b = makeExpense({ due_date: "2026-08-20", amount: 200 });
    const c = makeExpense({ due_date: "2026-09-10", amount: 150 }); // still within 30 days of TODAY
    const outOfWindow = makeExpense({ due_date: "2026-12-01", amount: 999 });

    await render(
      <DashboardScreen
        expenses={[a, b, c, outOfWindow]}
        isError={false}
        onRetry={jest.fn()}
        onMarkPaid={jest.fn()}
        todayIso={TODAY}
      />
    );

    expect(screen.getByText("450.00 EUR")).toBeTruthy();
  });

  it("displays 0.00 rather than blank when nothing is upcoming", async () => {
    await render(
      <DashboardScreen expenses={[]} isError={false} onRetry={jest.fn()} onMarkPaid={jest.fn()} todayIso={TODAY} />
    );

    expect(screen.getByText("0.00 EUR")).toBeTruthy();
  });

  it("decreases immediately when an upcoming expense is marked paid", async () => {
    const expense = makeExpense({ name: "Internet", due_date: "2026-08-20", amount: 100, status: "planned" });
    const { rerender } = await render(
      <DashboardScreen expenses={[expense]} isError={false} onRetry={jest.fn()} onMarkPaid={jest.fn()} todayIso={TODAY} />
    );

    // Also the only (and therefore biggest) upcoming expense, so its amount
    // legitimately renders more than once (list row + total + biggest card).
    expect(screen.getAllByText("100.00 EUR").length).toBeGreaterThan(0);

    await rerender(
      <DashboardScreen
        expenses={[{ ...expense, status: "paid" }]}
        isError={false}
        onRetry={jest.fn()}
        onMarkPaid={jest.fn()}
        todayIso={TODAY}
      />
    );

    expect(screen.getByText("0.00 EUR")).toBeTruthy();
    expect(screen.queryByText("100.00 EUR")).toBeNull();
  });
});

describe("DashboardScreen — biggest upcoming expense (US3)", () => {
  it("highlights the single largest upcoming expense with its name, amount, and due date", async () => {
    const small = makeExpense({ name: "Small one", due_date: "2026-08-20", amount: 80 });
    const big = makeExpense({ name: "Big one", due_date: "2026-08-22", amount: 650 });

    await render(
      <DashboardScreen expenses={[small, big]} isError={false} onRetry={jest.fn()} onMarkPaid={jest.fn()} todayIso={TODAY} />
    );

    // Renders in both the list and the biggest-expense card.
    expect(screen.getAllByText("Big one").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/650\.00 EUR/).length).toBeGreaterThan(0);
  });

  it("shows an empty-state message on the card when nothing is due in the next 30 days", async () => {
    await render(
      <DashboardScreen expenses={[]} isError={false} onRetry={jest.fn()} onMarkPaid={jest.fn()} todayIso={TODAY} />
    );

    expect(screen.getByText("Nothing big due in the next 30 days.")).toBeTruthy();
  });
});
