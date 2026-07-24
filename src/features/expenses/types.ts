export type ExpenseRecurrence = "monthly" | "yearly" | null;
export type ExpenseStatus = "planned" | "paid" | "skipped";

export interface Expense {
  id: string;
  user_id: string;
  category_id: string;
  name: string;
  amount: number;
  currency: string;
  due_date: string;
  recurrence: ExpenseRecurrence;
  status: ExpenseStatus;
  paid_at: string | null;
  rolled_from_id: string | null;
  notes: string | null;
  created_at: string;
}

// Minimal shape needed to populate the category picker; the `categories`
// table (F1) has more columns than this, but the sheet only needs these.
export interface ExpenseCategoryOption {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

export interface CreateExpenseInput {
  name: string;
  amount: number;
  due_date: string;
  category_id?: string | null;
  recurrence?: ExpenseRecurrence;
  notes?: string | null;
}

export interface UpdateExpenseInput {
  id: string;
  name?: string;
  amount?: number;
  due_date?: string;
  category_id?: string;
  recurrence?: ExpenseRecurrence;
  notes?: string | null;
}
