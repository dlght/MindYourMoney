import { isIosNotInstalled, isWebPushSupported } from "@/features/rules/webPushSupport";

const IOS_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const ANDROID_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

function setUserAgent(userAgent: string) {
  Object.defineProperty(navigator, "userAgent", { value: userAgent, configurable: true });
}

function setStandalone(value: boolean | undefined) {
  Object.defineProperty(navigator, "standalone", { value, configurable: true });
}

function setDisplayModeStandalone(matches: boolean) {
  window.matchMedia = jest.fn().mockReturnValue({ matches } as MediaQueryList);
}

function setNavigatorHasServiceWorker(has: boolean) {
  if (has) {
    Object.defineProperty(navigator, "serviceWorker", {
      value: {},
      configurable: true,
    });
  } else {
    // @ts-expect-error test-only deletion to simulate an unsupported browser
    delete navigator.serviceWorker;
  }
}

function setWindowHas(prop: "PushManager" | "Notification", has: boolean) {
  if (has) {
    (window as unknown as Record<string, unknown>)[prop] = {};
  } else {
    delete (window as unknown as Record<string, unknown>)[prop];
  }
}

describe("isWebPushSupported", () => {
  afterEach(() => {
    setNavigatorHasServiceWorker(false);
    setWindowHas("PushManager", false);
    setWindowHas("Notification", false);
  });

  it("returns true when serviceWorker, PushManager, and Notification are all present", () => {
    setNavigatorHasServiceWorker(true);
    setWindowHas("PushManager", true);
    setWindowHas("Notification", true);

    expect(isWebPushSupported()).toBe(true);
  });

  it("returns false when serviceWorker is missing (e.g. an older/unsupported browser)", () => {
    setNavigatorHasServiceWorker(false);
    setWindowHas("PushManager", true);
    setWindowHas("Notification", true);

    expect(isWebPushSupported()).toBe(false);
  });

  it("returns false when PushManager is missing", () => {
    setNavigatorHasServiceWorker(true);
    setWindowHas("PushManager", false);
    setWindowHas("Notification", true);

    expect(isWebPushSupported()).toBe(false);
  });

  it("returns false when Notification is missing", () => {
    setNavigatorHasServiceWorker(true);
    setWindowHas("PushManager", true);
    setWindowHas("Notification", false);

    expect(isWebPushSupported()).toBe(false);
  });
});

describe("isIosNotInstalled", () => {
  const originalUserAgent = navigator.userAgent;

  afterEach(() => {
    setUserAgent(originalUserAgent);
    setStandalone(undefined);
    setDisplayModeStandalone(false);
  });

  it("returns true for an iOS Safari tab that hasn't been added to the home screen", () => {
    setUserAgent(IOS_USER_AGENT);
    setStandalone(false);
    setDisplayModeStandalone(false);

    expect(isIosNotInstalled()).toBe(true);
  });

  it("returns false once navigator.standalone reports the PWA is installed", () => {
    setUserAgent(IOS_USER_AGENT);
    setStandalone(true);
    setDisplayModeStandalone(false);

    expect(isIosNotInstalled()).toBe(false);
  });

  it("returns false once matchMedia display-mode reports standalone", () => {
    setUserAgent(IOS_USER_AGENT);
    setStandalone(false);
    setDisplayModeStandalone(true);

    expect(isIosNotInstalled()).toBe(false);
  });

  it("returns false for a non-iOS user agent regardless of standalone state", () => {
    setUserAgent(ANDROID_USER_AGENT);
    setStandalone(false);
    setDisplayModeStandalone(false);

    expect(isIosNotInstalled()).toBe(false);
  });
});
