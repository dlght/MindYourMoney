export interface RuleFormValues {
  name: string;
  // Empty string means "any amount" (min_amount: null).
  minAmount: string;
  daysBefore: string;
  // Empty string means no repeat trigger (repeat_days_before: null).
  repeatDaysBefore: string;
}

export interface RuleFormErrors {
  name?: string;
  minAmount?: string;
  daysBefore?: string;
  repeatDaysBefore?: string;
  submit?: string;
}

function isIntegerInRange(value: string, min: number, max: number): boolean {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max;
}

// Client-side only (mirrors expenses/validation.ts). minAmount/
// repeatDaysBefore are optional fields (FR-003) — an empty string is valid
// and means "any amount" / "no second reminder", not a validation error.
export function validateRuleForm(values: RuleFormValues): RuleFormErrors {
  const errors: RuleFormErrors = {};

  if (!values.name.trim()) {
    errors.name = "Name is required.";
  }

  if (values.minAmount.trim()) {
    const parsedAmount = Number(values.minAmount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      errors.minAmount = "Amount must be a positive number, or left blank for any amount.";
    }
  }

  if (!isIntegerInRange(values.daysBefore, 0, 30)) {
    errors.daysBefore = "Days before must be a whole number between 0 and 30.";
  }

  if (values.repeatDaysBefore.trim()) {
    const parsedRepeat = Number(values.repeatDaysBefore);
    const parsedPrimary = Number(values.daysBefore);
    if (!isIntegerInRange(values.repeatDaysBefore, 0, 30)) {
      errors.repeatDaysBefore = "Repeat reminder must be a whole number between 0 and 30.";
    } else if (!Number.isNaN(parsedPrimary) && parsedRepeat >= parsedPrimary) {
      errors.repeatDaysBefore = "Repeat reminder must be sooner than the primary days-before value.";
    }
  }

  return errors;
}

export function isRuleFormValid(errors: RuleFormErrors): boolean {
  return Object.keys(errors).length === 0;
}
