export type PushPlatform = "ios" | "android";

export interface PushToken {
  id: string;
  user_id: string;
  device_installation_id: string;
  expo_push_token: string;
  platform: PushPlatform;
  last_ticket_id: string | null;
  last_ticket_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertPushTokenInput {
  deviceInstallationId: string;
  expoPushToken: string;
  platform: PushPlatform;
}
