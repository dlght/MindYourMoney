import { biggestUpcoming, groupByMonthWindow, monthWindowLabel, upcomingTotal } from "@/features/dashboard/selectors";
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

describe("groupByMonthWindow", () => {
  it("includes only planned expenses due within the current calendar month by default", () => {
    const earlyInMonth = makeExpense({ name: "Early in month", due_date: "2026-08-01" });
    const today = makeExpense({ name: "Today", due_date: TODAY });
    const lastDayOfMonth = makeExpense({ name: "Last day", due_date: "2026-08-31" });
    const nextMonth = makeExpense({ name: "Next month", due_date: "2026-09-01" });
    const lastMonth = makeExpense({ name: "Last month", due_date: "2026-07-31" });

    const groups = groupByMonthWindow(
      [earlyInMonth, today, lastDayOfMonth, nextMonth, lastMonth],
      TODAY
    );
    const names = groups.flatMap((group) => group.expenses.map((expense) => expense.name));

    expect(names).toEqual(expect.arrayContaining(["Early in month", "Today", "Last day"]));
    expect(names).not.toContain("Next month");
    expect(names).not.toContain("Last month");
  });

  it("includes an overdue-but-still-planned expense earlier this month (not just from today forward)", () => {
    const overdue = makeExpense({ name: "Overdue", due_date: "2026-08-05" });

    const groups = groupByMonthWindow([overdue], TODAY);
    const names = groups.flatMap((group) => group.expenses.map((expense) => expense.name));

    expect(names).toContain("Overdue");
  });

  it("extends into a further month once monthsAhead is increased", () => {
    const nextMonth = makeExpense({ name: "Next month", due_date: "2026-09-10" });
    const twoMonthsOut = makeExpense({ name: "Two months out", due_date: "2026-10-10" });

    const zeroAhead = groupByMonthWindow([nextMonth, twoMonthsOut], TODAY, 0);
    expect(zeroAhead.flatMap((g) => g.expenses.map((e) => e.name))).toEqual([]);

    const oneAhead = groupByMonthWindow([nextMonth, twoMonthsOut], TODAY, 1);
    expect(oneAhead.flatMap((g) => g.expenses.map((e) => e.name))).toEqual(["Next month"]);

    const twoAhead = groupByMonthWindow([nextMonth, twoMonthsOut], TODAY, 2);
    expect(twoAhead.flatMap((g) => g.expenses.map((e) => e.name)).sort()).toEqual([
      "Next month",
      "Two months out",
    ]);
  });

  it("excludes paid and skipped expenses", () => {
    const planned = makeExpense({ name: "Planned", due_date: "2026-08-20", status: "planned" });
    const paid = makeExpense({ name: "Paid", due_date: "2026-08-20", status: "paid" });
    const skipped = makeExpense({ name: "Skipped", due_date: "2026-08-20", status: "skipped" });

    const groups = groupByMonthWindow([planned, paid, skipped], TODAY);
    const names = groups.flatMap((group) => group.expenses.map((expense) => expense.name));

    expect(names).toEqual(["Planned"]);
  });

  it("labels today's group as 'Today' rather than a raw date", () => {
    const expense = makeExpense({ due_date: TODAY });
    const groups = groupByMonthWindow([expense], TODAY);

    expect(groups[0].dateLabel).toBe("Today");
  });

  it("orders groups chronologically and sorts a shared-date group by amount desc then name", () => {
    const soon = makeExpense({ name: "Soon", due_date: "2026-08-16" });
    const laterSmall = makeExpense({ name: "Zebra", due_date: "2026-08-20", amount: 50 });
    const laterBig = makeExpense({ name: "Alpha", due_date: "2026-08-20", amount: 200 });

    const groups = groupByMonthWindow([laterBig, soon, laterSmall], TODAY);

    expect(groups.map((group) => group.isoDate)).toEqual(["2026-08-16", "2026-08-20"]);
    expect(groups[1].expenses.map((expense) => expense.name)).toEqual(["Alpha", "Zebra"]);
  });

  it("returns an empty array when nothing qualifies", () => {
    expect(groupByMonthWindow([], TODAY)).toEqual([]);
  });
});

describe("upcomingTotal", () => {
  it("sums only planned expenses within the same current-month window the list uses", () => {
    const inWindow = makeExpense({ due_date: "2026-08-20", amount: 100 });
    const alsoInWindow = makeExpense({ due_date: "2026-08-05", amount: 50.5 });
    const nextMonth = makeExpense({ due_date: "2026-09-01", amount: 999 });
    const paidInWindow = makeExpense({ due_date: "2026-08-22", amount: 999, status: "paid" });

    const total = upcomingTotal([inWindow, alsoInWindow, nextMonth, paidInWindow], TODAY);

    expect(total.totalCents).toBe(15050);
  });

  it("includes the next month's total once expanded", () => {
    const thisMonth = makeExpense({ due_date: "2026-08-20", amount: 100 });
    const nextMonth = makeExpense({ due_date: "2026-09-01", amount: 50 });

    expect(upcomingTotal([thisMonth, nextMonth], TODAY, 0).totalCents).toBe(10000);
    expect(upcomingTotal([thisMonth, nextMonth], TODAY, 1).totalCents).toBe(15000);
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
  it("picks the highest-amount planned expense within the current month", () => {
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

  it("returns null when there are no planned expenses in the current month", () => {
    const tooFar = makeExpense({ due_date: "2026-12-01" });
    const paid = makeExpense({ due_date: "2026-08-20", status: "paid" });

    expect(biggestUpcoming([tooFar, paid], TODAY).expense).toBeNull();
    expect(biggestUpcoming([], TODAY).expense).toBeNull();
  });

  it("finds a further month's biggest expense once expanded", () => {
    const nextMonth = makeExpense({ name: "Next month big one", due_date: "2026-09-15", amount: 700 });

    expect(biggestUpcoming([nextMonth], TODAY, 0).expense).toBeNull();
    expect(biggestUpcoming([nextMonth], TODAY, 1).expense?.name).toBe("Next month big one");
  });
});

describe("monthWindowLabel", () => {
  // Locale-agnostic on purpose (matches formatDateLabel's existing
  // Intl.DateTimeFormat(undefined, ...) convention elsewhere in this file)
  // — asserted against the same formatter rather than a hardcoded English
  // month name, since this correctly renders in the device's own locale.
  const monthName = (year: number, month: number) =>
    new Intl.DateTimeFormat(undefined, { month: "long" }).format(new Date(year, month, 1));

  it("names just the current month when monthsAhead is 0", () => {
    expect(monthWindowLabel(TODAY, 0)).toBe(monthName(2026, 7));
  });

  it("names both months when monthsAhead is 1", () => {
    expect(monthWindowLabel(TODAY, 1)).toBe(`${monthName(2026, 7)} & ${monthName(2026, 8)}`);
  });

  it("uses a generic '+N more months' phrasing beyond 1", () => {
    expect(monthWindowLabel(TODAY, 2)).toBe(`${monthName(2026, 7)} + 2 more months`);
  });

  it("rolls over the year correctly at a December boundary", () => {
    expect(monthWindowLabel("2026-12-15", 1)).toBe(`${monthName(2026, 11)} & ${monthName(2027, 0)}`);
  });
});
