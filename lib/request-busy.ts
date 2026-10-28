// Only user-triggered writes block the dashboard; background reads/heartbeats do not.
export function blocksDashboard(input: RequestInfo | URL, init: RequestInit | undefined, origin: string) {
  const request = typeof Request !== "undefined" && input instanceof Request ? input : null;
  const url = new URL(request ? request.url : String(input), origin);
  const method = (init?.method || request?.method || "GET").toUpperCase();
  return url.origin === origin && url.pathname.startsWith("/api/") && url.pathname !== "/api/auth/activity" && ["POST", "PUT", "PATCH", "DELETE"].includes(method);
}

export function trackBusyRequests(fetcher: typeof fetch, origin: string, onChange: (count: number) => void): typeof fetch {
  let pending = 0;
  return async (input, init) => {
    const blocking = blocksDashboard(input, init, origin);
    if (blocking) onChange(++pending);
    try {
      const response = await fetcher(input, init);
      // fetch resolves at the headers. Keep the screen locked until JSON arrives.
      if (blocking && response.headers.get("content-type")?.includes("application/json")) await response.clone().text();
      return response;
    } finally {
      if (blocking) onChange(--pending);
    }
  };
}
