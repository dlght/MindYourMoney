import { supabase } from "@/lib/supabase";
import type { PushToken, UpsertPushTokenInput } from "@/features/push/types";

// Upsert on (user_id, device_installation_id) — the unique constraint from
// push-tokens-schema.sql — so re-registering the same device (token
// rotation, re-login) updates the existing row instead of creating a
// duplicate (FR-001). Passes through whichever shape the input actually
// carries — expoPushToken for "ios"/"android", the web* fields for "web"
// (F8, contracts/push-tokens-web-schema.sql) — the unused shape's columns
// are left undefined so Postgres keeps its existing null/not-null values
// from the check constraint's perspective.
export async function upsertPushToken(
  userId: string,
  input: UpsertPushTokenInput
): Promise<PushToken> {
  const { data, error } = await supabase
    .from("push_tokens")
    .upsert(
      {
        user_id: userId,
        device_installation_id: input.deviceInstallationId,
        platform: input.platform,
        expo_push_token: input.expoPushToken,
        web_endpoint: input.webEndpoint,
        web_p256dh: input.webP256dh,
        web_auth: input.webAuth,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,device_installation_id" }
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

// Called on sign-out (FR-007) so a former user's device stops being
// targeted by server-sent reminders the moment they sign out, not just
// when their token eventually goes stale.
export async function deletePushToken(userId: string, deviceInstallationId: string): Promise<void> {
  const { error } = await supabase
    .from("push_tokens")
    .delete()
    .eq("user_id", userId)
    .eq("device_installation_id", deviceInstallationId);

  if (error) {
    throw error;
  }
}
