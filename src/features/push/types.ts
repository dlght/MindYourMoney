export type PushPlatform = "ios" | "android" | "web";

export interface PushToken {
  id: string;
  user_id: string;
  device_installation_id: string;
  // Populated for platform "ios"/"android"; null for "web" (data-model.md).
  expo_push_token: string | null;
  platform: PushPlatform;
  // Populated for platform "web"; null for "ios"/"android".
  web_endpoint: string | null;
  web_p256dh: string | null;
  web_auth: string | null;
  last_ticket_id: string | null;
  last_ticket_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

// Exactly one shape is populated depending on platform: expoPushToken for
// "ios"/"android", the web* fields for "web" (contracts/push-tokens-web-schema.sql).
export interface UpsertPushTokenInput {
  deviceInstallationId: string;
  platform: PushPlatform;
  expoPushToken?: string;
  webEndpoint?: string;
  webP256dh?: string;
  webAuth?: string;
}
