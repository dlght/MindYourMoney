export interface DefaultCategory {
  name: string;
  icon: string;
  color: string;
}

// Source of truth: docs/mindyourmoney-spec.md §2 "Expense groups (categories)".
// "Other" is always last — it is the fallback so expense entry never blocks
// on categorization.
export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  { name: "Housing", icon: "house", color: "indigo" },
  { name: "Utilities", icon: "bolt", color: "amber" },
  { name: "Transport", icon: "car", color: "blue" },
  { name: "Groceries & Household", icon: "cart", color: "green" },
  { name: "Health", icon: "heart", color: "red" },
  { name: "Subscriptions", icon: "repeat", color: "purple" },
  { name: "Education & Kids", icon: "book", color: "teal" },
  { name: "Lifestyle & Leisure", icon: "sparkles", color: "pink" },
  { name: "Debt & Savings", icon: "bank", color: "slate" },
  { name: "Taxes & Fees", icon: "receipt", color: "orange" },
  { name: "Other", icon: "dots", color: "gray" },
] as const;
