"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function AttendanceRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const lastRefresh = useRef(0);
  const refreshing = useRef(false);
  useEffect(() => { refreshing.current = pending; }, [pending]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible" && !refreshing.current && Date.now() - lastRefresh.current >= 15000) {
        lastRefresh.current = Date.now();
        refreshing.current = true;
        startTransition(() => router.refresh());
      }
    };
    const interval = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router]);

  return null;
}
