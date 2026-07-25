import { useEffect } from "react";
import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppState, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "@/features/auth/useSession";
import { useNotificationReconciliation } from "@/features/rules/useNotificationReconciliation";
import { themeColors } from "@/theme/colors";
import { getTabBarStyle } from "@/theme/tabBarStyle";

export default function TabsLayout() {
  const { isSignedIn } = useSession();
  const colorScheme = useColorScheme() ?? "light";
  const colors = themeColors[colorScheme];
  const insets = useSafeAreaInsets();
  const reconcile = useNotificationReconciliation();

  // FR-008/research.md #7(c): local notifications can only be reconciled
  // while the app is running, so a full reconciliation pass on every
  // foreground corrects for anything that changed (or simply expired)
  // while the app was closed.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        reconcile();
      }
    });

    return () => subscription.remove();
  }, [reconcile]);

  if (!isSignedIn) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: getTabBarStyle(insets, colors),
        // Larger label + a taller per-item touch area than RN Navigation's
        // defaults — real-device feedback was that the bar felt small and
        // hard to tap even once the safe-area/elevation fix (F7) landed.
        tabBarLabelStyle: { fontSize: 12, fontWeight: "500" },
        tabBarItemStyle: { paddingVertical: 4 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <Ionicons name="home" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: "Add",
          tabBarIcon: ({ color }) => <Ionicons name="add-circle" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="rules"
        options={{
          title: "Rules",
          tabBarIcon: ({ color }) => <Ionicons name="notifications" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <Ionicons name="settings" size={26} color={color} />,
        }}
      />
    </Tabs>
  );
}
