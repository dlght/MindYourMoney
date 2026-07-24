import { biggestUpcoming, groupNext30Days, upcomingTotal } from "@/features/dashboard/selectors";
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

const TODAY = "2026-08-15";

describe("groupNext30Days", () => {
  it("includes only planned expenses due within the inclusive 30-day window", () => {
    const inWindow = makeExpense({ name: "In window", due_date: "2026-08-20" });
    const today = makeExpense({ name: "Today", due_date: TODAY });
    const boundary = makeExpense({ name: "Boundary", due_date: "2026-09-13" }); // today + 29
    const tooFar = makeExpense({ name: "Too far", due_date: "2026-09-14" }); // today + 30
    const tooSoon = makeExpense({ name: "Yesterday", due_date: "2026-08-14" });

    const groups = groupNext30Days([inWindow, today, boundary, tooFar, tooSoon], TODAY);
    const names = groups.flatMap((group) => group.expenses.map((expense) => expense.name));

    expect(names).toEqual(expect.arrayContaining(["In window", "Today", "Boundary"]));
    expect(names).not.toContain("Too far");
    expect(names).not.toContain("Yesterday");
  });

  it("excludes paid and skipped expenses", () => {
    const planned = makeExpense({ name: "Planned", due_date: "2026-08-20", status: "planned" });
    const paid = makeExpense({ name: "Paid", due_date: "2026-08-20", status: "paid" });
    const skipped = makeExpense({ name: "Skipped", due_date: "2026-08-20", status: "skipped" });

    const groups = groupNext30Days([planned, paid, skipped], TODAY);
    const names = groups.flatMap((group) => group.expenses.map((expense) => expense.name));

    expect(names).toEqual(["Planned"]);
  });

  it("labels today's group as 'Today' rather than a raw date", () => {
    const expense = makeExpense({ due_date: TODAY });
    const groups = groupNext30Days([expense], TODAY);

    expect(groups[0].dateLabel).toBe("Today");
  });

  it("orders groups chronologically and sorts a shared-date group by amount desc then name", () => {
    const soon = makeExpense({ name: "Soon", due_date: "2026-08-16" });
    const laterSmall = makeExpense({ name: "Zebra", due_date: "2026-08-20", amount: 50 });
    const laterBig = makeExpense({ name: "Alpha", due_date: "2026-08-20", amount: 200 });

    const groups = groupNext30Days([laterBig, soon, laterSmall], TODAY);

    expect(groups.map((group) => group.isoDate)).toEqual(["2026-08-16", "2026-08-20"]);
    expect(groups[1].expenses.map((expense) => expense.name)).toEqual(["Alpha", "Zebra"]);
  });

  it("returns an empty array when nothing qualifies", () => {
    expect(groupNext30Days([], TODAY)).toEqual([]);
  });
});

describe("upcomingTotal", () => {
  it("sums only planned expenses within the same inclusive 30-day window the list uses", () => {
    const inWindow = makeExpense({ due_date: "2026-08-20", amount: 100 });
    const alsoInWindow = makeExpense({ due_date: "2026-09-05", amount: 50.5 }); // today + 21, still in window
    const tooFar = makeExpense({ due_date: "2026-09-20", amount: 999 });
    const paidInWindow = makeExpense({ due_date: "2026-08-22", amount: 999, status: "paid" });

    const total = upcomingTotal([inWindow, alsoInWindow, tooFar, paidInWindow], TODAY);

    expect(total.totalCents).toBe(15050);
  });

  it("decreases once a contributing expense is marked paid (simulated by status change)", () => {
    const expense = makeExpense({ due_date: "2026-08-20", amount: 100, status: "planned" });
    const before = upcomingTotal([expense], TODAY);
    expect(before.totalCents).toBe(10000);

    const afterMarkPaid = { ...expense, status: "paid" as const };
    const after = upcomingTotal([afterMarkPaid], TODAY);
    expect(after.totalCents).toBe(0);
  });

  it("returns 0 when nothing qualifies", () => {
    const total = upcomingTotal([], TODAY);
    expect(total.totalCents).toBe(0);
  });

  it("sums many rows in integer cents without float drift", () => {
    const expenses = Array.from({ length: 10 }, () => makeExpense({ due_date: "2026-08-20", amount: 0.1 }));
    const total = upcomingTotal(expenses, TODAY);

    expect(total.totalCents).toBe(100); // 10 * 0.1 == 1.00 exactly in cents, not 0.9999999999999999
  });
});

describe("biggestUpcoming", () => {
  it("picks the highest-amount planned expense within the next 30 days", () => {
    const small = makeExpense({ name: "Small", due_date: "2026-08-20", amount: 80 });
    const big = makeExpense({ name: "Big", due_date: "2026-08-22", amount: 650 });
    const medium = makeExpense({ name: "Medium", due_date: "2026-08-25", amount: 120 });

    const result = biggestUpcoming([small, big, medium], TODAY);

    expect(result.expense?.name).toBe("Big");
  });

  it("breaks a tie on amount by choosing the soonest due date", () => {
    const later = makeExpense({ name: "Later", due_date: "2026-08-25", amount: 500 });
    const sooner = makeExpense({ name: "Sooner", due_date: "2026-08-18", amount: 500 });

    const result = biggestUpcoming([later, sooner], TODAY);

    expect(result.expense?.name).toBe("Sooner");
  });

  it("breaks a further tie (same amount, same due date) by name", () => {
    const zebra = makeExpense({ name: "Zebra", due_date: "2026-08-20", amount: 500 });
    const alpha = makeExpense({ name: "Alpha", due_date: "2026-08-20", amount: 500 });

    const result = biggestUpcoming([zebra, alpha], TODAY);

    expect(result.expense?.name).toBe("Alpha");
  });

  it("returns null when there are no planned expenses in the next 30 days", () => {
    const tooFar = makeExpense({ due_date: "2026-12-01" });
    const paid = makeExpense({ due_date: "2026-08-20", status: "paid" });

    expect(biggestUpcoming([tooFar, paid], TODAY).expense).toBeNull();
    expect(biggestUpcoming([], TODAY).expense).toBeNull();
  });
});
