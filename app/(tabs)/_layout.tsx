import { useEffect } from "react";
import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppState, useColorScheme } from "react-native";
import { useSession } from "@/features/auth/useSession";
import { useNotificationReconciliation } from "@/features/rules/useNotificationReconciliation";
import { themeColors } from "@/theme/colors";

export default function TabsLayout() {
  const { isSignedIn } = useSession();
  const colorScheme = useColorScheme() ?? "light";
  const colors = themeColors[colorScheme];
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
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: "Add",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="add-circle" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="rules"
        options={{
          title: "Rules",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="notifications" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
