import { Platform } from "react-native";

// PWA conversion: registers the runtime-caching service worker
// (public/sw.js) so the app shell works offline and Chrome/Edge treat the
// site as installable. No-op on native and on browsers without SW support
// (e.g. non-installed Safari still runs fine, just without this).
export function registerServiceWorker(): void {
  if (Platform.OS !== "web") {
    return;
  }
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  const register = () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("Service worker registration failed", error);
    });
  };

  // This module runs after the app bundle has already started executing
  // (script tag is `defer`red), so the page's own `load` event has often
  // already fired by the time we get here — attaching a "load" listener at
  // that point would never call back. Register immediately in that case.
  if (document.readyState === "complete") {
    register();
  } else {
    window.addEventListener("load", register);
  }
}
