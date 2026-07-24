import { useCallback } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { getDeviceInstallationId } from "@/lib/deviceId";
import { upsertPushToken } from "@/features/push/pushTokenApi";
import type { PushPlatform } from "@/features/push/types";

function currentPlatform(): PushPlatform | null {
  return Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : null;
}

/**
 * Registers this device to receive server-sent reminders (FR-001) once
 * notification permission is granted — mirrors the permission check
 * notificationScheduler.ts already performs for local notifications, but
 * only proceeds (never requests) here so sign-in doesn't independently
 * trigger a second permission prompt; the first prompt still comes from
 * useNotificationReconciliation's existing reconcile() call.
 */
export function usePushRegistration() {
  return useCallback(async (userId: string) => {
    const platform = currentPlatform();
    if (!platform) {
      return;
    }

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      return;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      return;
    }

    const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
    const deviceInstallationId = await getDeviceInstallationId();

    await upsertPushToken(userId, { deviceInstallationId, expoPushToken, platform });
  }, []);
}
