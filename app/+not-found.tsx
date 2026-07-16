import { View, Text } from "react-native";
import { Link } from "expo-router";

export default function NotFoundScreen() {
  return (
    <View className="flex-1 items-center justify-center gap-2 bg-white dark:bg-slate-900">
      <Text className="text-lg font-semibold text-slate-900 dark:text-white">
        This screen doesn't exist.
      </Text>
      <Link href="/" className="text-indigo-600 dark:text-indigo-400">
        Go to home screen
      </Link>
    </View>
  );
}
