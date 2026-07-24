import { supabase } from "@/lib/supabase";
import type {
  CreateExpenseInput,
  Expense,
  ExpenseCategoryOption,
  UpdateExpenseInput,
} from "@/features/expenses/types";

// Small, unpaginated on purpose (research.md #8): the dashboard and
// notification reconciliation only ever need planned (unpaid) expenses, and
// that set stays roughly constant in size over an account's lifetime since
// paid/skipped rows fall out of it — it's never the source of unbounded
// growth, so it doesn't need the pagination listExpensesPage below adds.
export async function listPlannedExpenses(userId: string): Promise<Expense[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "planned")
    .order("due_date", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

// Paginated, all statuses — backs the "Expenses" tab's full browsable
// history (FR-014), the actual unbounded-growth surface for a long-lived
// account.
export async function listExpensesPage(
  userId: string,
  range: { from: number; to: number }
): Promise<Expense[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("user_id", userId)
    .order("due_date", { ascending: true })
    .range(range.from, range.to);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function listCategoryOptions(userId: string): Promise<ExpenseCategoryOption[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, icon, color")
    .eq("user_id", userId)
    .eq("archived", false)
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function resolveDefaultCategoryId(userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .eq("name", "Other")
    .limit(1)
    .single();

  if (error) {
    throw error;
  }

  return data.id;
}

// Defaults category_id to the user's "Other" category (FR-003) even if a
// caller other than the sheet's own UI-level default (which already
// pre-selects "Other") omits it — belt-and-suspenders per FR-012/SC-004.
export async function createExpense(userId: string, input: CreateExpenseInput): Promise<Expense> {
  const categoryId = input.category_id ?? (await resolveDefaultCategoryId(userId));

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      user_id: userId,
      category_id: categoryId,
      name: input.name,
      amount: input.amount,
      due_date: input.due_date,
      recurrence: input.recurrence ?? null,
      notes: input.notes ?? null,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

// Delegates to the `mark_expense_paid` Postgres function (research.md #1),
// which atomically flips status and inserts the roll-forward row in one
// transaction gated on the row's prior status — safe to call repeatedly on
// the same id (FR-010): only the first call against a "planned" row does
// anything, subsequent calls are a no-op.
export async function markExpensePaid(id: string): Promise<Expense> {
  const { data, error } = await supabase.rpc("mark_expense_paid", { expense_id: id });

  if (error) {
    throw error;
  }

  return data;
}

export async function updateExpense({ id, ...changes }: UpdateExpenseInput): Promise<Expense> {
  const { data, error } = await supabase
    .from("expenses")
    .update(changes)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from("expenses").delete().eq("id", id);

  if (error) {
    throw error;
  }
}
