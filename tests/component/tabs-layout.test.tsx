import React from "react";
import { render, screen } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import TabsLayout from "../../app/(tabs)/_layout";
import { useSession } from "@/features/auth/useSession";

jest.mock("@/features/auth/useSession");
jest.mock("expo-router", () => {
  const RN = require("react-native");
  const actual = jest.requireActual("expo-router");
  return {
    ...actual,
    Redirect: jest.fn(() => null),
    Tabs: Object.assign(
      ({ children }: { children: React.ReactNode }) => <>{children}</>,
      {
        Screen: ({ options }: { options: { title: string } }) => (
          <RN.Text>{options.title}</RN.Text>
        ),
      }
    ),
  };
});

const mockUseSession = useSession as jest.Mock;

// TabsLayout mounts useNotificationReconciliation (for the AppState
// foreground reconciliation listener), which needs a QueryClient — the
// real app provides one at app/_layout.tsx, above where TabsLayout mounts.
function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("TabsLayout", () => {
  it("redirects a signed-out user to sign-in instead of rendering tabs", async () => {
    mockUseSession.mockReturnValue({ isSignedIn: false });

    await renderWithQueryClient(<TabsLayout />);

    expect(Redirect).toHaveBeenCalledWith(
      expect.objectContaining({ href: "/(auth)/sign-in" }),
      undefined
    );
  });

  it("renders all four tabs for a signed-in user", async () => {
    mockUseSession.mockReturnValue({ isSignedIn: true });

    await renderWithQueryClient(<TabsLayout />);

    expect(screen.getByText("Home")).toBeTruthy();
    expect(screen.getByText("Add")).toBeTruthy();
    expect(screen.getByText("Rules")).toBeTruthy();
    expect(screen.getByText("Settings")).toBeTruthy();
  });
});
