import { deletePushToken, upsertPushToken } from "@/features/push/pushTokenApi";
import { supabase } from "@/lib/supabase";

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

describe("upsertPushToken", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("upserts scoped to the given user, keyed on (user_id, device_installation_id)", async () => {
    const single = jest.fn().mockResolvedValue({
      data: {
        id: "token-1",
        user_id: "user-1",
        device_installation_id: "device-1",
        expo_push_token: "ExponentPushToken[abc]",
        platform: "ios",
        last_ticket_id: null,
        last_ticket_sent_at: null,
        created_at: "2026-07-24T00:00:00.000Z",
        updated_at: "2026-07-24T00:00:00.000Z",
      },
      error: null,
    });
    const select = jest.fn().mockReturnValue({ single });
    const upsert = jest.fn().mockReturnValue({ select });
    (supabase.from as jest.Mock).mockReturnValue({ upsert });

    const result = await upsertPushToken("user-1", {
      deviceInstallationId: "device-1",
      expoPushToken: "ExponentPushToken[abc]",
      platform: "ios",
    });

    expect(supabase.from).toHaveBeenCalledWith("push_tokens");
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        device_installation_id: "device-1",
        expo_push_token: "ExponentPushToken[abc]",
        platform: "ios",
      }),
      { onConflict: "user_id,device_installation_id" }
    );
    expect(result.id).toBe("token-1");
  });

  it("propagates an error instead of silently swallowing it", async () => {
    const single = jest.fn().mockResolvedValue({ data: null, error: new Error("insert failed") });
    const select = jest.fn().mockReturnValue({ single });
    const upsert = jest.fn().mockReturnValue({ select });
    (supabase.from as jest.Mock).mockReturnValue({ upsert });

    await expect(
      upsertPushToken("user-1", {
        deviceInstallationId: "device-1",
        expoPushToken: "ExponentPushToken[abc]",
        platform: "ios",
      })
    ).rejects.toThrow("insert failed");
  });
});

describe("deletePushToken", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("deletes scoped to the given user and device", async () => {
    const secondEq = jest.fn().mockResolvedValue({ error: null });
    const firstEq = jest.fn().mockReturnValue({ eq: secondEq });
    const del = jest.fn().mockReturnValue({ eq: firstEq });
    (supabase.from as jest.Mock).mockReturnValue({ delete: del });

    await deletePushToken("user-1", "device-1");

    expect(supabase.from).toHaveBeenCalledWith("push_tokens");
    expect(firstEq).toHaveBeenCalledWith("user_id", "user-1");
    expect(secondEq).toHaveBeenCalledWith("device_installation_id", "device-1");
  });

  it("propagates an error instead of silently swallowing it", async () => {
    const secondEq = jest.fn().mockResolvedValue({ error: new Error("delete failed") });
    const firstEq = jest.fn().mockReturnValue({ eq: secondEq });
    const del = jest.fn().mockReturnValue({ eq: firstEq });
    (supabase.from as jest.Mock).mockReturnValue({ delete: del });

    await expect(deletePushToken("user-1", "device-1")).rejects.toThrow("delete failed");
  });
});
