import React from "react";
import { render, screen } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import TabsLayout from "../../app/(tabs)/_layout";
import { useSession } from "@/features/auth/useSession";
import { themeColors } from "@/theme/colors";

jest.mock("@/features/auth/useSession");

const mockTabsScreenOptions = jest.fn();

jest.mock("expo-router", () => {
  const RN = require("react-native");
  const actual = jest.requireActual("expo-router");
  return {
    ...actual,
    Redirect: jest.fn(() => null),
    Tabs: Object.assign(
      ({
        children,
        screenOptions,
      }: {
        children: React.ReactNode;
        screenOptions: unknown;
      }) => {
        mockTabsScreenOptions(screenOptions);
        return <>{children}</>;
      },
      {
        Screen: ({ options }: { options: { title: string } }) => (
          <RN.Text>{options.title}</RN.Text>
        ),
      }
    ),
  };
});

const mockUseSession = useSession as jest.Mock;

const ZERO_INSETS_METRICS = {
  frame: { x: 0, y: 0, width: 0, height: 0 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

// TabsLayout mounts useNotificationReconciliation (for the AppState
// foreground reconciliation listener), which needs a QueryClient — the
// real app provides one at app/_layout.tsx, above where TabsLayout mounts.
// It also reads useSafeAreaInsets() for the tab bar style
// (contracts/tab-bar-visibility-contract.md), which requires a
// SafeAreaProvider ancestor, also provided by the real app.
function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient();
  return render(
    <SafeAreaProvider initialMetrics={ZERO_INSETS_METRICS}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </SafeAreaProvider>
  );
}

describe("TabsLayout", () => {
  beforeEach(() => {
    mockTabsScreenOptions.mockClear();
  });

  it("redirects a signed-out user to sign-in instead of rendering tabs", async () => {
    mockUseSession.mockReturnValue({ isSignedIn: false });

    await renderWithProviders(<TabsLayout />);

    expect(Redirect).toHaveBeenCalledWith(
      expect.objectContaining({ href: "/(auth)/sign-in" }),
      undefined
    );
  });

  it("renders all four tabs for a signed-in user", async () => {
    mockUseSession.mockReturnValue({ isSignedIn: true });

    await renderWithProviders(<TabsLayout />);

    expect(screen.getByText("Home")).toBeTruthy();
    expect(screen.getByText("Add")).toBeTruthy();
    expect(screen.getByText("Rules")).toBeTruthy();
    expect(screen.getByText("Settings")).toBeTruthy();
  });

  it("gives the tab bar a surface background distinct from the page background (contracts/tab-bar-visibility-contract.md)", async () => {
    mockUseSession.mockReturnValue({ isSignedIn: true });

    await renderWithProviders(<TabsLayout />);

    expect(mockTabsScreenOptions).toHaveBeenCalled();
    const screenOptions = mockTabsScreenOptions.mock.calls.at(-1)?.[0] as {
      tabBarStyle: { backgroundColor: string; paddingBottom: number };
    };
    expect(screenOptions.tabBarStyle.backgroundColor).toBe(themeColors.light.surface);
    expect(screenOptions.tabBarStyle.paddingBottom).toBeGreaterThanOrEqual(8);
  });
});
