import { computeDesiredNotifications } from "@/features/rules/notificationEngine";
import type { Expense } from "@/features/expenses/types";
import type { Rule } from "@/features/rules/types";

let nextExpenseId = 1;
let nextRuleId = 1;

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  const id = `exp-${nextExpenseId++}`;
  return {
    id,
    user_id: "user-1",
    category_id: "cat-1",
    name: "Expense",
    amount: 100,
    currency: "EUR",
    due_date: "2026-08-25",
    recurrence: null,
    status: "planned",
    paid_at: null,
    rolled_from_id: null,
    notes: null,
    created_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeRule(overrides: Partial<Rule> = {}): Rule {
  const id = `rule-${nextRuleId++}`;
  return {
    id,
    user_id: "user-1",
    name: "Test rule",
    enabled: true,
    is_default: false,
    is_grouped: false,
    min_amount: null,
    category_ids: null,
    days_before: 5,
    repeat_days_before: null,
    created_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

const TODAY = "2026-08-15";

describe("computeDesiredNotifications — matching", () => {
  it("produces a primary-trigger candidate for an expense that meets the amount threshold", () => {
    const rule = makeRule({ name: "Big expense ahead", min_amount: 200, days_before: 5 });
    const expense = makeExpense({ amount: 250, due_date: "2026-08-25" });

    const candidates = computeDesiredNotifications([rule], [expense], TODAY);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      ruleId: rule.id,
      triggerKind: "primary",
      triggerDateIso: "2026-08-20",
      expenseIds: [expense.id],
    });
  });

  it("does not produce a candidate when the expense is below the rule's amount threshold", () => {
    const rule = makeRule({ min_amount: 200, days_before: 5 });
    const expense = makeExpense({ amount: 100, due_date: "2026-08-25" });

    expect(computeDesiredNotifications([rule], [expense], TODAY)).toHaveLength(0);
  });

  it("matches any amount when the rule's min_amount is null", () => {
    const rule = makeRule({ min_amount: null, days_before: 1 });
    const expense = makeExpense({ amount: 5, due_date: "2026-08-16" });

    expect(computeDesiredNotifications([rule], [expense], TODAY)).toHaveLength(1);
  });

  it("respects an optional category filter", () => {
    const rule = makeRule({ category_ids: ["cat-groceries"], days_before: 5 });
    const matching = makeExpense({ category_id: "cat-groceries", due_date: "2026-08-25" });
    const nonMatching = makeExpense({ category_id: "cat-transport", due_date: "2026-08-25" });

    const candidates = computeDesiredNotifications([rule], [matching, nonMatching], TODAY);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].expenseIds).toEqual([matching.id]);
  });

  it("ignores disabled rules", () => {
    const rule = makeRule({ enabled: false, min_amount: null, days_before: 5 });
    const expense = makeExpense({ due_date: "2026-08-25" });

    expect(computeDesiredNotifications([rule], [expense], TODAY)).toHaveLength(0);
  });

  it("ignores expenses that are not in 'planned' status (paid expenses generate no candidate)", () => {
    const rule = makeRule({ min_amount: null, days_before: 5 });
    const paidExpense = makeExpense({ status: "paid", due_date: "2026-08-25" });

    expect(computeDesiredNotifications([rule], [paidExpense], TODAY)).toHaveLength(0);
  });
});

describe("computeDesiredNotifications — primary + repeat triggers", () => {
  it("produces both a primary and a repeat candidate when repeat_days_before is set", () => {
    const rule = makeRule({ min_amount: 200, days_before: 5, repeat_days_before: 1 });
    const expense = makeExpense({ amount: 250, due_date: "2026-08-25" });

    const candidates = computeDesiredNotifications([rule], [expense], TODAY);
    const kinds = candidates.map((candidate) => candidate.triggerKind).sort();

    expect(kinds).toEqual(["primary", "repeat"]);
    const repeat = candidates.find((candidate) => candidate.triggerKind === "repeat");
    expect(repeat?.triggerDateIso).toBe("2026-08-24");
  });
});

describe("computeDesiredNotifications — past trigger points are skipped (FR-009)", () => {
  it("omits a trigger point whose computed date has already passed", () => {
    // due in 3 days, but rule wants 5-days-before -> that date is in the past
    const rule = makeRule({ min_amount: null, days_before: 5, repeat_days_before: 1 });
    const expense = makeExpense({ due_date: "2026-08-18" });

    const candidates = computeDesiredNotifications([rule], [expense], TODAY);

    // the 5-days-before point (2026-08-13) is in the past and must be
    // skipped, but the 1-day-before point (2026-08-17) is still upcoming
    expect(candidates).toHaveLength(1);
    expect(candidates[0].triggerKind).toBe("repeat");
    expect(candidates[0].triggerDateIso).toBe("2026-08-17");
  });

  it("produces no candidates at all once every trigger point for an expense has passed", () => {
    const rule = makeRule({ min_amount: null, days_before: 5, repeat_days_before: 1 });
    const expense = makeExpense({ due_date: "2026-08-15" }); // due today

    expect(computeDesiredNotifications([rule], [expense], TODAY)).toHaveLength(0);
  });
});

describe("computeDesiredNotifications — grouped digest (User Story 2)", () => {
  it("combines multiple matching expenses due the same day into a single grouped candidate", () => {
    const rule = makeRule({ name: "Due tomorrow", is_grouped: true, min_amount: null, days_before: 1 });
    const a = makeExpense({ name: "A", due_date: "2026-08-16" });
    const b = makeExpense({ name: "B", due_date: "2026-08-16" });

    const candidates = computeDesiredNotifications([rule], [a, b], TODAY);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].triggerKind).toBe("grouped");
    expect(candidates[0].expenseIds.sort()).toEqual([a.id, b.id].sort());
  });

  it("produces no grouped candidate when nothing matches that day", () => {
    const rule = makeRule({ is_grouped: true, min_amount: null, days_before: 1 });

    expect(computeDesiredNotifications([rule], [], TODAY)).toHaveLength(0);
  });
});

describe("computeDesiredNotifications — cross-rule dedupe (FR-011, Edge Cases)", () => {
  it("prefers the per-expense reminder over the grouped digest when both would fire for the same expense/date", () => {
    const bigExpenseRule = makeRule({
      name: "Big expense ahead",
      min_amount: 200,
      days_before: 5,
      repeat_days_before: 1,
    });
    const dueTomorrowRule = makeRule({
      name: "Due tomorrow",
      is_grouped: true,
      min_amount: null,
      days_before: 1,
    });
    // Due tomorrow AND above the big-expense threshold: both rules match
    // the 1-day-before trigger point for this same expense/date.
    const overlapping = makeExpense({ name: "Overlap", amount: 300, due_date: "2026-08-16" });
    const smallOther = makeExpense({ name: "Small", amount: 20, due_date: "2026-08-16" });

    const candidates = computeDesiredNotifications(
      [bigExpenseRule, dueTomorrowRule],
      [overlapping, smallOther],
      TODAY
    );

    // The overlapping expense gets exactly one notification (from the more
    // specific big-expense rule), and the grouped digest still fires for
    // the other (non-overlapping) expense due the same day.
    const overlapCandidates = candidates.filter((c) => c.expenseIds.includes(overlapping.id));
    expect(overlapCandidates).toHaveLength(1);
    expect(overlapCandidates[0].ruleId).toBe(bigExpenseRule.id);

    const grouped = candidates.find((c) => c.triggerKind === "grouped");
    expect(grouped?.expenseIds).toEqual([smallOther.id]);
    expect(grouped?.expenseIds).not.toContain(overlapping.id);
  });

  it("drops the grouped candidate entirely if every one of its expenses was claimed by a more specific rule", () => {
    const bigExpenseRule = makeRule({ name: "Big expense ahead", min_amount: 200, days_before: 1 });
    const dueTomorrowRule = makeRule({ name: "Due tomorrow", is_grouped: true, min_amount: null, days_before: 1 });
    const onlyExpense = makeExpense({ amount: 300, due_date: "2026-08-16" });

    const candidates = computeDesiredNotifications([bigExpenseRule, dueTomorrowRule], [onlyExpense], TODAY);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].ruleId).toBe(bigExpenseRule.id);
    expect(candidates.some((c) => c.triggerKind === "grouped")).toBe(false);
  });
});

describe("computeDesiredNotifications — deterministic identifiers", () => {
  it("produces a stable identifier for the same rule/expense/trigger-kind combination", () => {
    const rule = makeRule({ min_amount: null, days_before: 5 });
    const expense = makeExpense({ due_date: "2026-08-25" });

    const first = computeDesiredNotifications([rule], [expense], TODAY);
    const second = computeDesiredNotifications([rule], [expense], TODAY);

    expect(first[0].identifier).toBe(second[0].identifier);
  });

  it("produces a stable identifier for a grouped digest keyed by rule + trigger date", () => {
    const rule = makeRule({ is_grouped: true, min_amount: null, days_before: 1 });
    const expense = makeExpense({ due_date: "2026-08-16" });

    const first = computeDesiredNotifications([rule], [expense], TODAY);
    const second = computeDesiredNotifications([rule], [expense], TODAY);

    expect(first[0].identifier).toBe(second[0].identifier);
  });
});
