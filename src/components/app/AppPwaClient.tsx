"use client";

import { useEffect, useSyncExternalStore } from "react";

function subscribeToOnlineStatus(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getIsOffline(): boolean {
  return !navigator.onLine;
}

/**
 * Client-only PWA glue for the authenticated app shell (Phase 20):
 * registers the app-shell service worker (public/app-sw.js, scope
 * /app/) and renders a banner while the browser reports itself
 * offline. Both are best-effort/progressive-enhancement — a browser
 * without service worker support, or one that never fires the
 * online/offline events reliably, just never shows the banner and the
 * app behaves exactly as it did before this phase.
 *
 * Online status is read via useSyncExternalStore (the API React
 * designed for subscribing to a browser platform value like this)
 * rather than an effect + setState, which avoids both a hydration
 * mismatch (server has no `navigator`) and an extra render pass.
 */
export function AppPwaClient() {
  const isOffline = useSyncExternalStore(subscribeToOnlineStatus, getIsOffline, () => false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/app-sw.js", { scope: "/app/" }).catch(() => {
      // Registration failures (unsupported browser, blocked by policy) are
      // non-fatal — the app works identically without the service worker,
      // just without offline-fallback/installability.
    });
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      className="border-b border-border/70 bg-warning/10 px-4 py-2 text-center text-sm font-medium text-warning sm:px-6"
    >
      You&apos;re offline. Changes you make now won&apos;t be saved until you reconnect.
    </div>
  );
}
