import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { createActivityToken, IDLE_COOKIE, SESSION_COOKIE } from "@/lib/session-idle";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  if (!await getCurrentUser()) return NextResponse.json({ error: "Tu sesión ha caducado.", code: "SESSION_EXPIRED" }, { status: 401, headers: { "X-Session-Expired": "1" } });
  const jar = await cookies();
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(IDLE_COOKIE, await createActivityToken(jar.get(SESSION_COOKIE)!.value), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 604800 });
  return response;
}
