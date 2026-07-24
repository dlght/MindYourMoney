import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface ScreenPlaceholderProps {
  title: string;
  description: string;
}

export function ScreenPlaceholder({ title, description }: ScreenPlaceholderProps) {
  return (
    <SafeAreaView
      edges={["top"]}
      className="flex-1 items-center justify-center gap-2 bg-white px-6 dark:bg-slate-900"
    >
      <Text className="text-xl font-semibold text-slate-900 dark:text-white">{title}</Text>
      <Text className="text-center text-slate-600 dark:text-slate-400">{description}</Text>
    </SafeAreaView>
  );
}
