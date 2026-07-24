// AsyncStorage's native module isn't available under Jest — this is the
// package's own documented mock (src/lib/deviceId.ts is this project's
// first real usage, F5).
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// @sentry/react-native ships ESM in nested dependencies (@sentry/core) that
// Jest's default transformIgnorePatterns can't parse. AuthProvider.tsx now
// imports it at module scope (self-critique F2's retry/report fix), so
// every test that transitively imports AuthProvider needs this mocked, not
// just the one test file that explicitly exercises it (error-boundary.test.tsx's
// local jest.mock still applies there and takes precedence).
jest.mock("@sentry/react-native", () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureCheckIn: jest.fn(),
  flush: jest.fn().mockResolvedValue(true),
}));
