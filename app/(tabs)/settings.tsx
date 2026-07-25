import { useEffect, useState } from "react";
import { Platform, Text, Pressable, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "@/features/auth/useSession";

// TEMPORARY diagnostic block (remove once the real-device tab bar issue is
// root-caused) — shows the raw values feeding getTabBarStyle plus a direct
// CSS env() probe, since react-native-safe-area-context's own reported
// insets could in principle disagree with what the browser itself resolves.
function SafeAreaDebugInfo() {
  const insets = useSafeAreaInsets();
  const [webInfo, setWebInfo] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web") {
      return;
    }
    const probe = document.createElement("div");
    probe.style.position = "fixed";
    probe.style.top = "0";
    probe.style.left = "0";
    probe.style.visibility = "hidden";
    probe.style.paddingBottom = "env(safe-area-inset-bottom)";
    probe.style.paddingTop = "env(safe-area-inset-top)";
    document.body.appendChild(probe);
    const computed = window.getComputedStyle(probe);
    const rawEnvBottom = computed.paddingBottom;
    const rawEnvTop = computed.paddingTop;
    document.body.removeChild(probe);

    const nav = navigator as Navigator & { standalone?: boolean };
    setWebInfo(
      [
        `standalone: ${nav.standalone}`,
        `displayMode standalone: ${window.matchMedia("(display-mode: standalone)").matches}`,
        `innerHeight: ${window.innerHeight}`,
        `visualViewport.height: ${window.visualViewport?.height ?? "n/a"}`,
        `devicePixelRatio: ${window.devicePixelRatio}`,
        `raw env(safe-area-inset-bottom): ${rawEnvBottom}`,
        `raw env(safe-area-inset-top): ${rawEnvTop}`,
      ].join("\n")
    );
  }, []);

  return (
    <View className="gap-1 rounded-lg border border-blue-300 bg-blue-50 px-4 py-3 dark:border-blue-700 dark:bg-blue-950">
      <Text className="font-semibold text-blue-900 dark:text-blue-200">Debug (temporary)</Text>
      <Text className="text-xs text-blue-800 dark:text-blue-300">Platform.OS: {Platform.OS}</Text>
      <Text className="text-xs text-blue-800 dark:text-blue-300">
        useSafeAreaInsets(): top={insets.top} bottom={insets.bottom} left={insets.left} right={insets.right}
      </Text>
      {webInfo ? (
        <Text className="text-xs text-blue-800 dark:text-blue-300">{webInfo}</Text>
      ) : null}
    </View>
  );
}

export default function SettingsScreen() {
  const { user, signOut } = useSession();

  return (
    // SafeAreaView's own className isn't compiled by NativeWind on web
    // (confirmed empirically — its class list passes through as inert
    // text with no matching CSS on web, while inner View/Text/Pressable
    // do get compiled); real layout/padding lives on the inner View
    // below, matching the working pattern already used by
    // app/(auth)/sign-in.tsx and the other three tab screens.
    <SafeAreaView edges={["top"]} className="flex-1 bg-white dark:bg-slate-900">
      <View className="flex-1 gap-4 px-6 pt-4 pb-6">
        <Text accessibilityRole="header" className="text-xl font-semibold text-slate-900 dark:text-white">
          Settings
        </Text>
        {user?.email ? (
          <Text className="text-slate-600 dark:text-slate-400">Signed in as {user.email}</Text>
        ) : null}
        <SafeAreaDebugInfo />
        <Pressable
          onPress={() => signOut()}
          className="items-center rounded-lg border border-red-300 px-4 py-3 dark:border-red-800"
          accessibilityRole="button"
        >
          <Text className="font-medium text-red-600 dark:text-red-400">Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
