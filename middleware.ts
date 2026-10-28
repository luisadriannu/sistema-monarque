import { NextRequest, NextResponse } from "next/server";
import { IDLE_COOKIE, SESSION_COOKIE, validIdleSession } from "@/lib/session-idle";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const publicApi = ["/api/auth/login", "/api/auth/logout", "/api/rsvp", "/api/invitacion/entrada"];
  if (publicApi.some(value => path === value || path === `${value}/`)) return NextResponse.next();
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  const active = await validIdleSession(session, request.cookies.get(IDLE_COOKIE)?.value);
  if (active) return NextResponse.next();
  const response = path.startsWith("/api/")
    ? NextResponse.json({ error: "Tu sesión ha caducado. Inicia sesión nuevamente.", code: "SESSION_EXPIRED" }, { status: 401, headers: { "X-Session-Expired": "1", "Cache-Control": "no-store" } })
    : NextResponse.redirect(new URL("/login?reason=session_expired", request.url));
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(IDLE_COOKIE);
  return response;
}
export const config = { matcher: ["/dashboard/:path*", "/api/:path*"] };
