import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { useSession } from "@/features/auth/useSession";
import { supabase } from "@/lib/supabase";

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

jest.mock("@/features/categories/seedCategories", () => ({
  seedCategories: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/features/rules/seedRules", () => ({
  seedRules: jest.fn(() => Promise.resolve()),
}));

function Probe() {
  const { isSignedIn, isLoading } = useSession();
  if (isLoading) return <Text>loading</Text>;
  return <Text>{isSignedIn ? "signed-in" : "signed-out"}</Text>;
}

describe("session restore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (supabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    });
  });

  it("restores a signed-in state when a persisted session exists", async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
    });

    await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText("signed-in")).toBeTruthy());
  });

  it("shows a signed-out state when no persisted session exists", async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
    });

    await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText("signed-out")).toBeTruthy());
  });
});
