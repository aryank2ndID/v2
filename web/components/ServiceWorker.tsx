"use client";

import React from "react";

/**
 * Registers the offline service worker once the page is interactive. Guarded
 * for https and localhost — the two places a service worker can run.
 *
 * Not in development. `sw.js` is cache-first for every non-navigation GET,
 * which is exactly right for a field kit on a hilltop and exactly wrong for a
 * dev server: chunk URLs are stable across rebuilds in dev, so the first
 * cached copy of `/_next/static/chunks/app/…/page.js` would be served forever
 * and no code change would ever appear. A stale worker from an earlier session
 * is torn down here too, so a developer who already has one installed is not
 * left permanently serving an old build.
 */
export function ServiceWorker() {
  React.useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const allowed = window.location.protocol === "https:" ||
      ["localhost", "127.0.0.1"].includes(window.location.hostname);
    if (!allowed) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .then(() => caches?.keys?.())
        .then((keys) => Promise.all((keys ?? []).map((k) => caches.delete(k))))
        .catch(() => { /* nothing to tear down */ });
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
