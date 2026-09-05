"use client";

import React from "react";

/**
 * Registers the offline service worker once the page is interactive. Guarded
 * for https and localhost — the two places a service worker can run — and for
 * environments that disable it (e.g. build-time prerender is not affected).
 */
export function ServiceWorker() {
  React.useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const allowed = window.location.protocol === "https:" ||
      ["localhost", "127.0.0.1"].includes(window.location.hostname);
    if (!allowed) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}