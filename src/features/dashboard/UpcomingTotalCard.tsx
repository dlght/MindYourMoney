import { Text, View } from "react-native";
import type { UpcomingTotal } from "@/features/dashboard/types";

interface UpcomingTotalCardProps {
  total: UpcomingTotal;
  // e.g. "July" or "July & August" — composed by DashboardScreen from the
  // current monthsAhead state (F9) so this card's copy never goes stale.
  windowLabel: string;
}

export function UpcomingTotalCard({ total, windowLabel }: UpcomingTotalCardProps) {
  const amount = (total.totalCents / 100).toFixed(2);

  return (
    <View className="mx-6 rounded-xl bg-indigo-600 px-4 py-3">
      <Text className="text-sm font-medium text-indigo-100">{windowLabel} total</Text>
      <Text className="text-2xl font-semibold text-white">
        {amount} {total.currency}
      </Text>
    </View>
  );
}
