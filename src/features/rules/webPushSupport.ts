// Feature/platform detection for the web-only notification permission flow
// (contracts/web-permission-ux-contract.md). expo-notifications' own
// permission APIs are deliberately not used here — they already no-op on
// web by design (notificationScheduler.ts); this reads the browser's own
// capabilities directly.

/** True only when the browser exposes everything Web Push needs. */
export function isWebPushSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * True when this is an iOS Safari session that has NOT been added to the
 * home screen — the one combination where Web Push can never work
 * (research.md #7), regardless of what isWebPushSupported() reports.
 */
export function isIosNotInstalled(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") {
    return false;
  }

  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (!isIos) {
    return false;
  }

  const nav = navigator as Navigator & { standalone?: boolean };
  const isStandalone =
    nav.standalone === true ||
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches);

  return !isStandalone;
}
