import React from "react";
import { Pressable, Text, View, useColorScheme } from "react-native";
import * as Sentry from "@sentry/react-native";
import { themeColors } from "@/theme/colors";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

function FallbackScreen({ onRetry }: { onRetry: () => void }) {
  const colorScheme = useColorScheme() ?? "light";
  const colors = themeColors[colorScheme];

  return (
    <View
      className="flex-1 items-center justify-center gap-4 px-6"
      style={{ backgroundColor: colors.background }}
    >
      <Text className="text-center text-slate-600 dark:text-slate-400">
        Something went wrong. Your data is safe — try again.
      </Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Try again"
        className="rounded-lg bg-indigo-600 px-4 py-2"
      >
        <Text className="font-medium text-white">Try again</Text>
      </Pressable>
    </View>
  );
}

// Root error boundary (FR-011): catches otherwise-unhandled render errors
// so the app shows a recoverable screen instead of a blank/frozen one, and
// reports the error to Sentry for the maintainer (research.md #6). Must be
// a class component — React has no hook-based error boundary API.
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return <FallbackScreen onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}
