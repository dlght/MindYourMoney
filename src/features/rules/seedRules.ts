import { supabase } from "@/lib/supabase";
import { DEFAULT_RULES } from "@/features/rules/defaultRules";

/**
 * Idempotent: a no-op if the user already has any rules (default or
 * otherwise), and a single batched insert of both defaults otherwise, so a
 * user is never observed with a partial default set (mirrors
 * seedCategories.ts / F1 research.md #5).
 */
export async function seedRules(userId: string): Promise<void> {
  const { data: existing, error: selectError } = await supabase
    .from("rules")
    .select("id")
    .eq("user_id", userId)
    .limit(1);

  if (selectError) {
    throw selectError;
  }

  if (existing && existing.length > 0) {
    return;
  }

  const rows = DEFAULT_RULES.map((rule) => ({
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
