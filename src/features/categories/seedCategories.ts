import { supabase } from "@/lib/supabase";
import { DEFAULT_CATEGORIES } from "@/features/categories/defaultCategories";

/**
 * Idempotent: a no-op if the user already has any categories (default or
 * otherwise), and a single batched insert of all 11 defaults otherwise, so
 * a user is never observed with a partial default set (FR-009/FR-010).
 */
export async function seedCategories(userId: string): Promise<void> {
  const { data: existing, error: selectError } = await supabase
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .limit(1);

  if (selectError) {
    throw selectError;
  }

  if (existing && existing.length > 0) {
    return;
  }

  const rows = DEFAULT_CATEGORIES.map((category) => ({
    user_id: userId,
    name: category.name,
    icon: category.icon,
    color: category.color,
    is_default: true,
    archived: false,
  }));

  const { error: insertError } = await supabase.from("categories").insert(rows);
  if (insertError) {
    throw insertError;
  }
}
