import { useEffect } from "react";
import { Redirect, Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppState } from "react-native";
import { useSession } from "@/features/auth/useSession";
import { useNotificationReconciliation } from "@/features/rules/useNotificationReconciliation";
import { CustomTabBar } from "@/features/navigation/CustomTabBar";

export default function TabsLayout() {
  const { isSignedIn } = useSession();
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
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
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
