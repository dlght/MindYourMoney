export interface DefaultRule {
  name: string;
  is_grouped: boolean;
  min_amount: number | null;
  category_ids: null;
  days_before: number;
  repeat_days_before: number | null;
}

// Source of truth: docs/mindyourmoney-spec.md §3 "Default rules shipped on
// first launch" (rules 1-2 — rule 3, the monthly heads-up digest, is
// explicitly deferred to MVP2, per spec.md Assumptions). The third entry
// below ("Due today") was added by
// specs/007-tabbar-visibility-default-reminder to close the gap where no
// default rule ever reminded the user on an expense's actual due date; it
// mirrors "Due tomorrow"'s grouping (data-model.md) so multiple same-day
// expenses still produce one digest, not a flood of notifications.
export const DEFAULT_RULES: readonly DefaultRule[] = [
  {
    name: "Big expense ahead",
    is_grouped: false,
    min_amount: 200,
    category_ids: null,
    days_before: 5,
    repeat_days_before: 1,
  },
  {
    name: "Due tomorrow",
    is_grouped: true,
    min_amount: null,
    category_ids: null,
    days_before: 1,
    repeat_days_before: null,
  },
  {
    name: "Due today",
    is_grouped: true,
    min_amount: null,
    category_ids: null,
    days_before: 0,
    repeat_days_before: null,
  },
] as const;
