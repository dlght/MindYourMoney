import { Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "@/features/auth/useSession";

export default function SettingsScreen() {
  const { user, signOut } = useSession();

  return (
    <SafeAreaView edges={["top"]} className="flex-1 gap-4 bg-white px-6 pt-4 dark:bg-slate-900">
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
    </SafeAreaView>
  );
}
