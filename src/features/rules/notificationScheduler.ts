import * as Notifications from "expo-notifications";
import { supabase } from "@/lib/supabase";
import type { NotificationCandidate } from "@/features/rules/types";

function toTriggerDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  // Fire at a fixed local hour rather than midnight so it reads as a
  // normal daytime reminder rather than a 00:00 alert.
  return new Date(year, month - 1, day, 9, 0, 0);
}

async function logNotification(
  userId: string,
  candidate: NotificationCandidate
): Promise<void> {
  const rows = candidate.expenseIds.map((expenseId) => ({
    user_id: userId,
    expense_id: expenseId,
    rule_id: candidate.ruleId,
    trigger_kind: candidate.triggerKind,
    // "local" distinguishes this device-scheduled path from the new
    // server-sent path (channel: "server", research.md #3, F5) so the two
    // can be deduped against each other via filterUndelivered.
    channel: "local",
  }));

  const { error } = await supabase.from("notifications_log").insert(rows);
  if (error) {
    // Logging failure must never block the actual reminder from being
    // scheduled — surface it for diagnostics only.
    console.error("Failed to write notifications_log entry", error);
  }
}

/**
 * Adapter (research.md #2/#6): diffs `desired` against whatever
 * expo-notifications currently has scheduled (the OS is the source of
 * truth for "what's scheduled"), cancels anything stale, and
 * (re-)schedules everything desired — cancel-then-reschedule
 * unconditionally rather than attempting a fragile cross-platform trigger
 * content comparison. Skips actually scheduling (and logging) when
 * notification permission is not granted (FR-014), while still cancelling
 * anything stale.
 */
export async function reconcileScheduledNotifications(
  userId: string,
  desired: NotificationCandidate[]
): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const desiredIdentifiers = new Set(desired.map((candidate) => candidate.identifier));

  for (const notification of scheduled) {
    if (!desiredIdentifiers.has(notification.identifier)) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }

  const { status: currentStatus } = await Notifications.getPermissionsAsync();
  let granted = currentStatus === "granted";
  if (!granted) {
    const requested = await Notifications.requestPermissionsAsync();
    granted = requested.status === "granted";
  }

  if (!granted) {
    return;
  }

  const scheduledIdentifiers = new Set(scheduled.map((notification) => notification.identifier));

  for (const candidate of desired) {
    if (scheduledIdentifiers.has(candidate.identifier)) {
      await Notifications.cancelScheduledNotificationAsync(candidate.identifier);
    }

    await Notifications.scheduleNotificationAsync({
      identifier: candidate.identifier,
      content: {
        title: candidate.title,
        body: candidate.body,
        data: {
          ruleId: candidate.ruleId,
          expenseIds: candidate.expenseIds,
          triggerKind: candidate.triggerKind,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: toTriggerDate(candidate.triggerDateIso),
      },
    });

    await logNotification(userId, candidate);
  }
}

/** Whether the app currently has permission to show notifications (FR-014). */
export async function hasNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted";
}
