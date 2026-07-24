import { supabase } from "@/lib/supabase";
import type { CreateRuleInput, Rule, UpdateRuleInput } from "@/features/rules/types";

export async function listRules(userId: string): Promise<Rule[]> {
  const { data, error } = await supabase
    .from("rules")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function createRule(userId: string, input: CreateRuleInput): Promise<Rule> {
  const { data, error } = await supabase
    .from("rules")
    .insert({
      user_id: userId,
      name: input.name,
      enabled: true,
      is_default: false,
      is_grouped: false,
      min_amount: input.min_amount ?? null,
      category_ids: input.category_ids ?? null,
      days_before: input.days_before,
      repeat_days_before: input.repeat_days_before ?? null,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateRule({ id, ...changes }: UpdateRuleInput): Promise<Rule> {
  const { data, error } = await supabase
    .from("rules")
    .update(changes)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

// FR-005: default rules can be disabled (via updateRule's `enabled` field)
// but never deleted — enforced here, at the API layer the UI always goes
// through, rather than only in a UI-level disabled-button state.
export async function deleteRule(rule: Rule): Promise<void> {
  if (rule.is_default) {
    throw new Error("Default rules can't be deleted — disable them instead.");
  }

  const { error } = await supabase.from("rules").delete().eq("id", rule.id);

  if (error) {
    throw error;
  }
}
