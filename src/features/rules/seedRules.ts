import { supabase } from "@/lib/supabase";
import { DEFAULT_RULES } from "@/features/rules/defaultRules";

/**
 * Idempotent, and self-healing across DEFAULT_RULES additions (F7,
 * contracts/default-rule-backfill-contract.md): inserts only the
 * DEFAULT_RULES entries whose `name` isn't already present among the
 * user's existing rules, rather than an all-or-nothing "has any rule at
 * all?" check. This is what lets an existing user who already has the
 * original two defaults still receive a newly-added third default on
 * their next sign-in, while a default rule they've since disabled (still
 * present by name, just `enabled: false`) is correctly left untouched —
 * never re-inserted or silently re-enabled.
 */
export async function seedRules(userId: string): Promise<void> {
  const { data: existing, error: selectError } = await supabase
    .from("rules")
    .select("name")
    .eq("user_id", userId);

  if (selectError) {
    throw selectError;
  }

  const existingNames = new Set((existing ?? []).map((row) => row.name));
  const missingDefaults = DEFAULT_RULES.filter((rule) => !existingNames.has(rule.name));

  if (missingDefaults.length === 0) {
    return;
  }

  const rows = missingDefaults.map((rule) => ({
    user_id: userId,
    name: rule.name,
    enabled: true,
    is_default: true,
    is_grouped: rule.is_grouped,
    min_amount: rule.min_amount,
    category_ids: rule.category_ids,
    days_before: rule.days_before,
    repeat_days_before: rule.repeat_days_before,
  }));

  const { error: insertError } = await supabase.from("rules").insert(rows);
  if (insertError) {
    throw insertError;
  }
}
