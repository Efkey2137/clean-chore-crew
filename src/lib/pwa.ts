// Client-only PWA service worker registration with iframe + preview guards.
export function registerPWA() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const isInIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  const host = window.location.hostname;
  const isPreviewHost =
    host.includes("id-preview--") ||
    host.includes("lovableproject.com") ||
    host.includes("lovableproject-dev.com") ||
    host.startsWith("preview--");

  if (isInIframe || isPreviewHost) {
    // Make sure no stale SW from earlier runs sticks around in preview.
    navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
    return;
  }

  import(/* @vite-ignore */ "virtual:pwa-register")
    .then((mod: { registerSW: (opts?: { immediate?: boolean }) => void }) => {
      mod.registerSW({ immediate: true });
    })
    .catch(() => {
      // virtual module only exists in production build
    });
}
