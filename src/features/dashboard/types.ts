import type { Expense } from "@/features/expenses/types";

export interface UpcomingGroup {
  isoDate: string;
  dateLabel: string;
  expenses: Expense[];
}

export interface UpcomingTotal {
  totalCents: number;
  currency: string;
}

export interface BiggestUpcoming {
  expense: Expense | null;
}
