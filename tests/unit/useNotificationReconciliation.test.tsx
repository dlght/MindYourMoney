import React from "react";
import { renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { useSession } from "@/features/auth/useSession";
import { useNotificationReconciliation } from "@/features/rules/useNotificationReconciliation";
import { supabase } from "@/lib/supabase";
import { reconcileScheduledNotifications } from "@/features/rules/notificationScheduler";

// Regression test for specs/006-pwa-e2e-layout-fix (US1): a reconciliation
// failure here must never reject the caller — it used to propagate and get
// mistaken for a failed expense save (see contracts/expense-save-error-contract.md).

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
  },
}));

jest.mock("@/features/categories/seedCategories", () => ({
  seedCategories: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/features/rules/seedRules", () => ({
  seedRules: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/features/push/usePushRegistration", () => ({
  usePushRegistration: () => jest.fn(() => Promise.resolve()),
}));

jest.mock("@/features/rules/notificationScheduler", () => ({
  reconcileScheduledNotifications: jest.fn(),
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}

describe("useNotificationReconciliation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
    });
    (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    });
  });

  it("does not throw when reconcileScheduledNotifications rejects", async () => {
    (reconcileScheduledNotifications as jest.Mock).mockRejectedValue(
      new Error("not supported on this platform")
    );

    const { result } = await renderHook(
      () => ({
        session: useSession(),
        reconcile: useNotificationReconciliation(),
      }),
      { wrapper: Wrapper }
    );

    await waitFor(() => expect(result.current.session.isSignedIn).toBe(true));

    await expect(result.current.reconcile()).resolves.toBeUndefined();
    expect(reconcileScheduledNotifications).toHaveBeenCalled();
  });
});
