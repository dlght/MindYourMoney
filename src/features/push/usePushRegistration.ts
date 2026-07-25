import { useCallback } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { getDeviceInstallationId } from "@/lib/deviceId";
import { upsertPushToken } from "@/features/push/pushTokenApi";
import { urlBase64ToUint8Array } from "@/features/push/vapidKey";
import { isWebPushSupported } from "@/features/rules/webPushSupport";
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

export type EnableWebPushResult =
  | { status: "subscribed" }
  | { status: "unsupported" }
  | { status: "denied" }
  | { status: "error"; message: string };

/**
 * Web-only counterpart to usePushRegistration, deliberately NOT wired into
 * the automatic sign-in/reconciliation call sites (contracts/
 * web-permission-ux-contract.md rule 3) — an unsolicited page-load
 * permission prompt is bad practice and often auto-denied by browsers, so
 * this is only reachable via an explicit user action (the Rules screen's
 * "Enable notifications" button).
 *
 * Everything from requestPermission() onward is wrapped in try/catch: a
 * granted permission does not guarantee subscribe() succeeds (e.g. a
 * browser/runtime that blocks the Push API for other reasons) — this must
 * resolve to a result the caller can render, never an unhandled rejection
 * (FR-006, graceful degradation).
 */
export function useEnableWebPush() {
  return useCallback(async (userId: string): Promise<EnableWebPushResult> => {
    if (Platform.OS !== "web" || !isWebPushSupported()) {
      return { status: "unsupported" };
    }

    const publicKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      return { status: "unsupported" };
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        return { status: "denied" };
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      const { endpoint, keys } = subscription.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
      const deviceInstallationId = await getDeviceInstallationId();

      await upsertPushToken(userId, {
        deviceInstallationId,
        platform: "web",
        webEndpoint: endpoint,
        webP256dh: keys.p256dh,
        webAuth: keys.auth,
      });

      return { status: "subscribed" };
    } catch (error) {
      return { status: "error", message: String(error) };
    }
  }, []);
}
