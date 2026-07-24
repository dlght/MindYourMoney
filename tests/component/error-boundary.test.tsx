import React from "react";
import { Text } from "react-native";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { ErrorBoundary } from "@/components/ErrorBoundary";

jest.mock("@sentry/react-native", () => ({
  captureException: jest.fn(),
}));

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("boom");
  }
  return <Text>All good</Text>;
}

describe("ErrorBoundary", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // React logs the caught error to console.error by design; silence it so
    // the intentional throw in these tests doesn't look like a test failure.
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("renders children normally when nothing throws", async () => {
    await render(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText("All good")).toBeTruthy();
  });

  it("renders a recoverable fallback instead of crashing when a child throws", async () => {
    await render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>
    );

    expect(
      screen.getByText("Something went wrong. Your data is safe — try again.")
    ).toBeTruthy();
    expect(screen.getByLabelText("Try again")).toBeTruthy();
  });

  it("reports the caught error to Sentry", async () => {
    const Sentry = require("@sentry/react-native");

    await render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>
    );

    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ extra: expect.anything() })
    );
  });

  it("recovers after retry once the underlying error condition is gone", async () => {
    let shouldThrow = true;
    function ConditionalBomb() {
      if (shouldThrow) {
        throw new Error("boom");
      }
      return <Text>Recovered</Text>;
    }

    await render(
      <ErrorBoundary>
        <ConditionalBomb />
      </ErrorBoundary>
    );
    expect(screen.getByLabelText("Try again")).toBeTruthy();

    shouldThrow = false;
    fireEvent.press(screen.getByLabelText("Try again"));

    expect(await screen.findByText("Recovered")).toBeTruthy();
  });
});
