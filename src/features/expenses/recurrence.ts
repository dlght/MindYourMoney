import type { ExpenseRecurrence } from "@/features/expenses/types";

// month is 1-based (1 = January) throughout this module.
export function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this one.
  return new Date(year, month, 0).getDate();
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

// Device-local "today" as a plain YYYY-MM-DD string, matching due_date's
// format so the two can be compared lexically with no timezone conversion.
export function getTodayIso(referenceDate: Date = new Date()): string {
  return formatDate(referenceDate.getFullYear(), referenceDate.getMonth() + 1, referenceDate.getDate());
}

// Adds 1 month/year to a "YYYY-MM-DD" due date, clamping to the last valid
// day of the target month when the original day doesn't exist there (e.g.
// Jan 31 -> Feb 28/29, not an overflowed Mar date) — per spec.md's Edge
// Cases and research.md #2. Pure/dependency-free: the app's only other date
// dependency is the Postgres side of `mark_expense_paid`, which applies the
// same clamping rule server-side.
export function nextOccurrence(dueDate: string, recurrence: ExpenseRecurrence): string {
  if (recurrence !== "monthly" && recurrence !== "yearly") {
    throw new Error(`nextOccurrence requires a recurring expense, got: ${recurrence}`);
  }

  const [year, month, day] = dueDate.split("-").map(Number);

  const targetYear = recurrence === "yearly" ? year + 1 : month === 12 ? year + 1 : year;
  const targetMonth = recurrence === "yearly" ? month : (month % 12) + 1;

  const clampedDay = Math.min(day, daysInMonth(targetYear, targetMonth));

  return formatDate(targetYear, targetMonth, clampedDay);
}

// Resolves the concrete due_date for a monthly-recurring expense from just a
// day-of-month, anchored to a base year/month — the expense's existing due
// date when editing (so editing the day never silently shifts the
// year/month), or the current year/month when creating one. Clamped to the
// base month's actual length (e.g. day 31 in a 30-day month -> the 30th).
export function resolveMonthlyDueDate(day: number, baseYear: number, baseMonth: number): string {
  return formatDate(baseYear, baseMonth, Math.min(day, daysInMonth(baseYear, baseMonth)));
}

// Resolves the concrete due_date for a yearly-recurring expense from a
// month + day, anchored to a base year — the expense's existing due date's
// year when editing, or the current year when creating.
export function resolveYearlyDueDate(month: number, day: number, baseYear: number): string {
  return formatDate(baseYear, month, Math.min(day, daysInMonth(baseYear, month)));
}
