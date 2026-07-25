import { Text, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "@/features/auth/useSession";

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
        <Text className="text-xl font-semibold text-slate-900 dark:text-white">Settings</Text>
        {user?.email ? (
          <Text className="text-slate-600 dark:text-slate-400">Signed in as {user.email}</Text>
        ) : null}
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
