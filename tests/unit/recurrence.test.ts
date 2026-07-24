import { nextOccurrence, resolveMonthlyDueDate, resolveYearlyDueDate } from "@/features/expenses/recurrence";

describe("nextOccurrence", () => {
  it("rolls a monthly expense forward by exactly one month in the common case", () => {
    expect(nextOccurrence("2026-03-15", "monthly")).toBe("2026-04-15");
  });

  it("clamps a monthly roll-forward from Jan 31 to Feb 28 in a non-leap year", () => {
    expect(nextOccurrence("2026-01-31", "monthly")).toBe("2026-02-28");
  });

  it("clamps a monthly roll-forward from Jan 31 to Feb 29 in a leap year", () => {
    expect(nextOccurrence("2028-01-31", "monthly")).toBe("2028-02-29");
  });

  it("rolls a monthly expense from December into January of the next year", () => {
    expect(nextOccurrence("2026-12-31", "monthly")).toBe("2027-01-31");
  });

  it("rolls a yearly expense forward by exactly one year in the common case", () => {
    expect(nextOccurrence("2026-06-01", "yearly")).toBe("2027-06-01");
  });

  it("clamps a yearly roll-forward from a leap day to Feb 28 the following year", () => {
    expect(nextOccurrence("2028-02-29", "yearly")).toBe("2029-02-28");
  });

  it("throws for a non-recurring expense", () => {
    expect(() => nextOccurrence("2026-01-01", null)).toThrow();
  });
});

describe("resolveMonthlyDueDate", () => {
  it("combines the given day with the base year/month", () => {
    expect(resolveMonthlyDueDate(15, 2026, 3)).toBe("2026-03-15");
  });

  it("clamps a day that doesn't exist in the base month", () => {
    expect(resolveMonthlyDueDate(31, 2026, 2)).toBe("2026-02-28");
  });

  it("does not clamp on a leap-year February", () => {
    expect(resolveMonthlyDueDate(29, 2028, 2)).toBe("2028-02-29");
  });
});

describe("resolveYearlyDueDate", () => {
  it("combines the given month/day with the base year", () => {
    expect(resolveYearlyDueDate(6, 1, 2026)).toBe("2026-06-01");
  });

  it("clamps Feb 29 to Feb 28 in a non-leap base year", () => {
    expect(resolveYearlyDueDate(2, 29, 2026)).toBe("2026-02-28");
  });

  it("keeps Feb 29 in a leap base year", () => {
    expect(resolveYearlyDueDate(2, 29, 2028)).toBe("2028-02-29");
  });
});
