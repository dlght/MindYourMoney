import type { Expense } from "@/features/expenses/types";
import type { BiggestUpcoming, UpcomingGroup, UpcomingTotal } from "@/features/dashboard/types";
import { toCents } from "@/lib/money";

export { toCents };

const NEXT_WINDOW_DAYS = 30;

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

function addDays(isoDate: string, days: number): string {
  const date = parseIsoDate(isoDate);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

function isPlanned(expense: Expense): boolean {
  return expense.status === "planned";
}

// due_date is a plain SQL date (no time-of-day/timezone component), so
// string comparison against string window bounds is exact — no Date-object
// timezone conversion risk (research.md #2).
function isWithinNext30Days(dueDate: string, todayIso: string): boolean {
  const windowEnd = addDays(todayIso, NEXT_WINDOW_DAYS - 1);
  return dueDate >= todayIso && dueDate <= windowEnd;
}

// Shared by groupNext30Days, upcomingTotal, and biggestUpcoming so the three
// dashboard sections always agree on exactly which expenses are "upcoming"
// (research.md #3, round 2 patch) — a mark-as-paid or delete that changes
// this set is reflected identically everywhere on the next render.
function planForNext30Days(expenses: Expense[], todayIso: string): Expense[] {
  return expenses.filter((expense) => isPlanned(expense) && isWithinNext30Days(expense.due_date, todayIso));
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

export function groupNext30Days(expenses: Expense[], todayIso: string = getTodayIso()): UpcomingGroup[] {
  const upcoming = planForNext30Days(expenses, todayIso);

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

// Sums the same next-30-days/planned-only set the list renders (see
// planForNext30Days above) — deliberately NOT a fixed calendar-month window.
// An earlier version summed the literal next calendar month independently
// of the visible list, which meant it rarely matched what a user was
// looking at and never visibly reacted to marking something paid unless
// that item happened to fall in that separate window. Renamed from
// `nextMonthTotal` accordingly (research.md #3, round 2 patch).
export function upcomingTotal(expenses: Expense[], todayIso: string = getTodayIso()): UpcomingTotal {
  const upcoming = planForNext30Days(expenses, todayIso);
  const currency = upcoming[0]?.currency ?? expenses[0]?.currency ?? "EUR";
  const totalCents = upcoming.reduce((sum, expense) => sum + toCents(expense.amount), 0);

  return { totalCents, currency };
}

// Tie-break (research.md #5): highest amount wins; ties broken by soonest
// due date, then by name, so the result is deterministic across renders.
// Amount comparison via toCents, not raw float subtraction (self-critique F10).
export function biggestUpcoming(expenses: Expense[], todayIso: string = getTodayIso()): BiggestUpcoming {
  const upcoming = planForNext30Days(expenses, todayIso);

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
