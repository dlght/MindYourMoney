import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/useSession";
import { createRule, deleteRule, updateRule } from "@/features/rules/rulesApi";
import { rulesQueryKey } from "@/features/rules/useRules";
import { useNotificationReconciliation } from "@/features/rules/useNotificationReconciliation";
import type { CreateRuleInput, Rule, UpdateRuleInput } from "@/features/rules/types";

// Rules are a short, low-frequency list (2 seeded + a handful of custom
// ones) — unlike the expense mutations, these don't need optimistic
// patching for a snappy feel; a plain invalidate-then-reconcile after each
// mutation keeps the logic simple while still satisfying Constitution V
// (notifications reconciled as part of the same operation).
export function useCreateRule() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const queryKey = rulesQueryKey(user?.id);
  const reconcile = useNotificationReconciliation();

  return useMutation({
    mutationFn: (input: CreateRuleInput) => createRule(user!.id, input),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey });
      await reconcile();
    },
  });
}

// Also used to toggle a rule's `enabled` state — that's just an update
// with `{ id, enabled }`, not a structurally distinct operation.
export function useUpdateRule() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const queryKey = rulesQueryKey(user?.id);
  const reconcile = useNotificationReconciliation();

  return useMutation({
    mutationFn: (input: UpdateRuleInput) => updateRule(input),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey });
      await reconcile();
    },
  });
}

export function useDeleteRule() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const queryKey = rulesQueryKey(user?.id);
  const reconcile = useNotificationReconciliation();

  return useMutation({
    mutationFn: (rule: Rule) => deleteRule(rule),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey });
      await reconcile();
    },
  });
}
