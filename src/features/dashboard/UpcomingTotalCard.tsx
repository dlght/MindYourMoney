import { Text, View } from "react-native";
import type { UpcomingTotal } from "@/features/dashboard/types";

interface UpcomingTotalCardProps {
  total: UpcomingTotal;
}

export function UpcomingTotalCard({ total }: UpcomingTotalCardProps) {
  const amount = (total.totalCents / 100).toFixed(2);

  return (
    <View className="mx-4 rounded-xl bg-indigo-600 px-4 py-3">
      <Text className="text-sm font-medium text-indigo-100">Upcoming total (next 30 days)</Text>
      <Text className="text-2xl font-semibold text-white">
        {amount} {total.currency}
      </Text>
    </View>
  );
}
