// Web Push adapter (F8, contracts/web-push-send-contract.md) — this
// function's Deno-side equivalent of usePushRegistration.ts's client-side
// subscribe flow. Structurally parallel to expoPush.ts, but simpler: the
// standard Web Push protocol has no separate delayed-receipt phase (the
// send response itself is authoritative — research.md #4), so there's no
// ticket/receipt bookkeeping equivalent to expoPush.ts's.
import webpush from "npm:web-push@3";

export interface WebPushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface WebPushMessage {
  subscription: WebPushSubscription;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export type WebPushResult = { status: "sent" } | { status: "gone" } | { status: "error"; message: string };

function configureVapid(): void {
  const publicKey = Deno.env.get("EXPO_PUBLIC_VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys are not configured (EXPO_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)");
  }
  webpush.setVapidDetails("mailto:support@mindyourmoney.app", publicKey, privateKey);
}

/**
 * Sends one Web Push message. A 404/410 response means the subscription is
 * gone — the caller deletes the corresponding push_tokens row immediately
 * (contracts/web-push-send-contract.md #4), no separate prune phase needed.
 */
export async function sendWebPush(message: WebPushMessage): Promise<WebPushResult> {
  configureVapid();

  const payload = JSON.stringify({
    title: message.title,
    body: message.body,
    data: message.data ?? {},
  });

  try {
    await webpush.sendNotification(
      {
        endpoint: message.subscription.endpoint,
        keys: { p256dh: message.subscription.p256dh, auth: message.subscription.auth },
      },
      payload
    );
    return { status: "sent" };
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) {
      return { status: "gone" };
    }
    return { status: "error", message: String(error) };
  }
}
