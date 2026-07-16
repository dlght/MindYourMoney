import { Redirect, Stack } from "expo-router";
import { useSession } from "@/features/auth/useSession";

export default function AuthLayout() {
  const { isSignedIn } = useSession();

  if (isSignedIn) {
    return <Redirect href="/(tabs)" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
