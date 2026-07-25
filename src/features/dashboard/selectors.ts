import type { Expense } from "@/features/expenses/types";
import type { BiggestUpcoming, UpcomingGroup, UpcomingTotal } from "@/features/dashboard/types";
import { toCents } from "@/lib/money";

export { toCents };

// Maximum number of additional calendar months a user can expand into
// beyond the current one (self-critique: unbounded expansion has no real
// product value and would let the "Show next month" button grow forever).
export const MAX_MONTHS_AHEAD = 3;

export function getTodayIso(referenceDate: Date = new Date()): string {
  return toIsoDate(referenceDate);
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isPlanned(expense: Expense): boolean {
  return expense.status === "planned";
}

// Calendar-month window (replaces a prior rolling "next 30 days" window,
// F9 — real-device feedback that a rolling window felt like "everything"
// rather than a scoped, predictable view). Starts at the 1st of the
// *current* month (not "today") so an overdue-but-still-planned expense
// earlier this month still surfaces rather than silently disappearing.
// `monthsAhead` extends the end boundary by that many additional whole
// calendar months — 0 = just the current month, 1 = current + next, etc.
function monthWindowStart(todayIso: string): string {
  const [year, month] = todayIso.split("-");
  return `${year}-${month}-01`;
}

function monthWindowEnd(todayIso: string, monthsAhead: number): string {
  const [year, month] = todayIso.split("-").map(Number);
  // Day 0 of a given month is JS Date's idiom for "the last day of the
  // previous month" — so day 0 of (month + monthsAhead + 1) is exactly the
  // last day of (month + monthsAhead).
  const end = new Date(year, month - 1 + monthsAhead + 1, 0);
  return toIsoDate(end);
}

// due_date is a plain SQL date (no time-of-day/timezone component), so
// string comparison against string window bounds is exact — no Date-object
// timezone conversion risk (research.md #2, F3).
function isWithinMonthWindow(dueDate: string, todayIso: string, monthsAhead: number): boolean {
  return dueDate >= monthWindowStart(todayIso) && dueDate <= monthWindowEnd(todayIso, monthsAhead);
}

// Shared by groupByMonthWindow, upcomingTotal, and biggestUpcoming so the
// three dashboard sections always agree on exactly which expenses are
// "in view" (research.md #3, round 2 patch — principle carried over from
// the prior 30-day-window design) — a mark-as-paid or delete that changes
// this set is reflected identically everywhere on the next render, and
// expanding to a further month updates all three together.
function planForMonthWindow(expenses: Expense[], todayIso: string, monthsAhead: number): Expense[] {
  return expenses.filter(
    (expense) => isPlanned(expense) && isWithinMonthWindow(expense.due_date, todayIso, monthsAhead)
  );
}

// Human label for the current window, used by the total/biggest cards so
// their copy never goes stale (previously hardcoded "next 30 days" text
// that became wrong the moment the underlying window logic changed).
export function monthWindowLabel(todayIso: string, monthsAhead: number): string {
  const [year, month] = todayIso.split("-").map(Number);
  const formatter = new Intl.DateTimeFormat(undefined, { month: "long" });
  const currentLabel = formatter.format(new Date(year, month - 1, 1));

  if (monthsAhead === 0) {
    return currentLabel;
  }
  if (monthsAhead === 1) {
    const nextLabel = formatter.format(new Date(year, month, 1));
    return `${currentLabel} & ${nextLabel}`;
  }
  return `${currentLabel} + ${monthsAhead} more months`;
}

function formatDateLabel(isoDate: string, todayIso: string): string {
  if (isoDate === todayIso) {
    return "Today";
  }
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(parseIsoDate(isoDate));
}

// Shared tie-break for expenses sharing a due-date group: biggest first,
// then alphabetical, per spec Assumptions. Compares via toCents (constitution
// VI applies to comparisons, not just sums — self-critique F10) rather than
// raw float subtraction.
function compareByAmountDescThenName(a: Expense, b: Expense): number {
  const centsDiff = toCents(b.amount) - toCents(a.amount);
  if (centsDiff !== 0) {
    return centsDiff;
  }
  return a.name.localeCompare(b.name);
}

export function groupByMonthWindow(
  expenses: Expense[],
  todayIso: string = getTodayIso(),
  monthsAhead = 0
): UpcomingGroup[] {
  const upcoming = planForMonthWindow(expenses, todayIso, monthsAhead);

  const byDate = new Map<string, Expense[]>();
  for (const expense of upcoming) {
    const bucket = byDate.get(expense.due_date) ?? [];
    bucket.push(expense);
    byDate.set(expense.due_date, bucket);
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([isoDate, groupExpenses]) => ({
      isoDate,
      dateLabel: formatDateLabel(isoDate, todayIso),
      expenses: [...groupExpenses].sort(compareByAmountDescThenName),
    }));
}

// Sums the same windowed/planned-only set the list renders (see
// planForMonthWindow above), so the total, the biggest-expense card, and
// the list always agree on exactly what's "in view" (research.md #3, round
// 2 patch) — including staying in sync as monthsAhead expands.
export function upcomingTotal(
  expenses: Expense[],
  todayIso: string = getTodayIso(),
  monthsAhead = 0
): UpcomingTotal {
  const upcoming = planForMonthWindow(expenses, todayIso, monthsAhead);
  const currency = upcoming[0]?.currency ?? expenses[0]?.currency ?? "EUR";
  const totalCents = upcoming.reduce((sum, expense) => sum + toCents(expense.amount), 0);

  return { totalCents, currency };
}

// Tie-break (research.md #5): highest amount wins; ties broken by soonest
// due date, then by name, so the result is deterministic across renders.
// Amount comparison via toCents, not raw float subtraction (self-critique F10).
export function biggestUpcoming(
  expenses: Expense[],
  todayIso: string = getTodayIso(),
  monthsAhead = 0
): BiggestUpcoming {
  const upcoming = planForMonthWindow(expenses, todayIso, monthsAhead);

  if (upcoming.length === 0) {
    return { expense: null };
  }

  const [winner] = [...upcoming].sort((a, b) => {
    const centsDiff = toCents(b.amount) - toCents(a.amount);
    if (centsDiff !== 0) {
      return centsDiff;
    }
    if (a.due_date !== b.due_date) {
      return a.due_date < b.due_date ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return { expense: winner };
}
