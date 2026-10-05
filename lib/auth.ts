import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import prisma from "./prisma";

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || "monarque-elite-secret-key-fallback-32chars"
);

const COOKIE_NAME = "monarque_session";

export interface SessionPayload {
  userId: string;
  email: string;
  rol: string;
  nombre: string;
}

/**
 * Crea un token JWT para la sesión
 */
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET_KEY);
}

/**
 * Verifica el token JWT
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Obtiene la sesión actual a partir de las cookies (Server Component / Route Handler)
 */
export async function getCurrentSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

/**
 * Obtiene el usuario autenticado completo desde la base de datos
 */
export async function getCurrentUser() {
  const session = await getCurrentSession();
  if (!session?.userId) return null;

  try {
    const user = await prisma.usuario.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        nombre: true,
        rol: true,
        creado_en: true,
      },
    });
    return user;
  } catch {
    return null;
  }
}

/**
 * Establece la cookie de sesión en la respuesta
 */
export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 días
  });
}

/**
 * Elimina la cookie de sesión
 */
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
