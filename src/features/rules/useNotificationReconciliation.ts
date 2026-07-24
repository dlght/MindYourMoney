import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/features/auth/useSession";
import { plannedExpensesQueryKey } from "@/features/expenses/useExpenses";
import { rulesQueryKey } from "@/features/rules/useRules";
import { computeDesiredNotifications, getTodayIso } from "@/features/rules/notificationEngine";
import { reconcileScheduledNotifications } from "@/features/rules/notificationScheduler";
import { usePushRegistration } from "@/features/push/usePushRegistration";
import type { Expense } from "@/features/expenses/types";
import type { Rule } from "@/features/rules/types";

/**
 * Recomputes the desired notification set from whatever rules/expenses are
 * currently cached (offline-tolerant, constitution IV) and reconciles the
 * device's scheduled notifications to match. Used both right after an
 * expense/rule mutation succeeds (constitution V) and on app foreground
 * (research.md #7).
 *
 * Also opportunistically (re-)attempts server push registration (F5,
 * self-critique F5) on every one of those same triggers — not just once at
 * sign-in — so a user who denies notification permission at sign-in and
 * grants it later (OS settings) gets registered on the next foreground or
 * mutation, without needing a dedicated permission-change listener.
 * `registerPush` itself is a no-op until permission is actually granted, so
 * this is cheap to call opportunistically.
 */
export function useNotificationReconciliation() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const registerPush = usePushRegistration();

  return useCallback(async () => {
    if (!user) {
      return;
    }

    const expenses = queryClient.getQueryData<Expense[]>(plannedExpensesQueryKey(user.id)) ?? [];
    const rules = queryClient.getQueryData<Rule[]>(rulesQueryKey(user.id)) ?? [];
    const desired = computeDesiredNotifications(rules, expenses, getTodayIso());

    await reconcileScheduledNotifications(user.id, desired);
    await registerPush(user.id).catch((error) => {
      console.error("Failed to register device for push notifications", error);
    });
  }, [user, queryClient, registerPush]);
}
