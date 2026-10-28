import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "monarque_session";
export const IDLE_COOKIE = "monarque_activity";
export function idleTimeoutSeconds() {
  const minutes = Number(process.env.SESSION_IDLE_TIMEOUT_MINUTES || 60);
  return (Number.isFinite(minutes) && minutes > 0 ? minutes : 60) * 60;
}
export function sessionKey() {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret && process.env.NODE_ENV === "production") throw new Error("JWT_SECRET es obligatorio en producción.");
  return new TextEncoder().encode(secret || "monarque-local-development-secret-only");
}
async function sessionDigest(token: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, "0")).join("");
}
export async function createActivityToken(session: string) {
  return new SignJWT({ session: await sessionDigest(session), activity: Date.now() })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d").sign(sessionKey());
}
export async function validIdleSession(session?: string, activity?: string, now = Date.now()) {
  if (!session || !activity) return false;
  try {
    await jwtVerify(session, sessionKey(), { algorithms: ["HS256"] });
    const { payload } = await jwtVerify(activity, sessionKey(), { algorithms: ["HS256"] });
    return payload.session === await sessionDigest(session) && typeof payload.activity === "number" && payload.activity <= now && now - payload.activity < idleTimeoutSeconds() * 1000;
  } catch { return false; }
}
