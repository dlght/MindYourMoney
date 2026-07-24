import * as Sentry from "@sentry/react-native";

// No-ops (safe by Sentry's own design) until EXPO_PUBLIC_SENTRY_DSN is set —
// this lets the app run/build normally before a real Sentry project exists
// (research.md #5/#6; see quickstart.md for the one-time account setup).
export function initSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    return;
  }
  Sentry.init({ dsn, tracesSampleRate: 0 });
}
