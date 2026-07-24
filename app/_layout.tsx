import "../global.css";
import { useEffect } from "react";
import { useColorScheme, View, ActivityIndicator } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Slot, useRouter, useSegments } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { useSession } from "@/features/auth/useSession";
import { themeColors } from "@/theme/colors";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { initSentry } from "@/lib/sentry";
import { registerServiceWorker } from "@/lib/registerServiceWorker";

initSentry();
registerServiceWorker();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoading } = useSession();
  const segments = useSegments();
  const router = useRouter();
  const colorScheme = useColorScheme() ?? "light";

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!isSignedIn && !inAuthGroup) {
      router.replace("/(auth)/sign-in");
    } else if (isSignedIn && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [isSignedIn, isLoading, segments, router]);

  if (isLoading) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: themeColors[colorScheme].background }}
      >
        <ActivityIndicator color={themeColors[colorScheme].accent} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <BottomSheetModalProvider>
                <AuthGate>
                  <Slot />
                </AuthGate>
              </BottomSheetModalProvider>
            </AuthProvider>
          </QueryClientProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
