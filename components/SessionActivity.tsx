"use client";

import { useEffect } from "react";

export default function SessionActivity() {
  useEffect(() => {
    const originalFetch = window.fetch;
    let redirecting = false;
    let active = true;
    let pending = false;
    let lastSent = 0;
    const wrappedFetch: typeof fetch = async (...args) => {
      const response = await originalFetch(...args);
      if (active && response.status === 401 && response.headers.get("X-Session-Expired") === "1" && !redirecting) {
        redirecting = true;
        window.location.assign("/login?reason=session_expired");
      }
      return response;
    };
    window.fetch = wrappedFetch;
    const activity = (event: Event) => {
      if (!event.isTrusted || pending || redirecting || document.visibilityState === "hidden" || Date.now() - lastSent < 30000) return;
      pending = true;
      lastSent = Date.now();
      void wrappedFetch("/api/auth/activity", { method: "POST", credentials: "same-origin", cache: "no-store" })
        .catch(() => {}).finally(() => { pending = false; });
    };
    const events = ["pointerdown", "keydown", "scroll", "touchstart"];
    events.forEach(name => window.addEventListener(name, activity, { passive: true, capture: true }));
    return () => {
      active = false;
      if (window.fetch === wrappedFetch) window.fetch = originalFetch;
      events.forEach(name => window.removeEventListener(name, activity, true));
    };
  }, []);
  return null;
}
