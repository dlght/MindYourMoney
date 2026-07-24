import type { ExpenseRecurrence } from "@/features/expenses/types";

export interface ExpenseFormValues {
  name: string;
  amount: string;
  recurrence: ExpenseRecurrence;
  // Only required when recurrence is null.
  dueDate: string;
  // Only required when recurrence is "monthly" or "yearly".
  day: string;
  // Only required when recurrence is "yearly".
  month: string;
}

export interface ExpenseFormErrors {
  name?: string;
  amount?: string;
  dueDate?: string;
  day?: string;
  month?: string;
  // Set when the save/delete request itself fails (e.g. a network or
  // server error), as opposed to a client-side field validation issue.
  submit?: string;
}

function isIntegerInRange(value: string, min: number, max: number): boolean {
  if (!value.trim()) return false;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max;
}

// Client-side only (FR-002, spec Edge Cases): rejects before any network
// call. Amount is validated as a decimal string, never coerced through a
// JS float comparison chain beyond the single Number() parse needed to
// check positivity (constitution VI). Which date field is required is
// conditional on recurrence: a one-off expense needs a full date, a
// monthly one needs only a day, a yearly one needs a month + day (the
// year is derived automatically — see recurrence.ts's resolve* helpers).
export function validateExpenseForm(values: ExpenseFormValues): ExpenseFormErrors {
  const errors: ExpenseFormErrors = {};

  if (!values.name.trim()) {
    errors.name = "Name is required.";
  }

  const parsedAmount = Number(values.amount);
  if (!values.amount.trim() || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
    errors.amount = "Amount must be a positive number.";
  }

  if (values.recurrence === null) {
    if (!values.dueDate.trim()) {
      errors.dueDate = "Due date is required.";
    }
  } else {
    if (!isIntegerInRange(values.day, 1, 31)) {
      errors.day = "Day must be between 1 and 31.";
    }
    if (values.recurrence === "yearly" && !isIntegerInRange(values.month, 1, 12)) {
      errors.month = "Month must be between 1 and 12.";
    }
  }

  return errors;
}

export function isExpenseFormValid(errors: ExpenseFormErrors): boolean {
  return Object.keys(errors).length === 0;
}
