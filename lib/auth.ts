import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import prisma from "./prisma";
import { isOrganizationServiceActive } from "./organization-access";

function getSecretKey() {
  const configured = process.env.JWT_SECRET?.trim();
  if (configured) return new TextEncoder().encode(configured);
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET es obligatorio en producción.");
  }
  return new TextEncoder().encode("monarque-local-development-secret-only");
}

const COOKIE_NAME = "monarque_session";

export interface SessionPayload {
  userId: string;
  email: string;
  rol: string;
  nombre: string;
  sessionVersion?: number;
}

/**
 * Crea un token JWT para la sesión
 */
export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecretKey());
}

/**
 * Verifica el token JWT
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
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
        session_version: true,
        eliminado_en: true,
        lector_qr_habilitado: true,
        organizacion_id: true,
        organizacion: {
          select: {
            id: true,
            nombre: true,
            qr_checkin_habilitado: true,
            plan: true,
            estado_servicio: true,
            servicio_vence_en: true,
            max_clientes: true,
            max_eventos_activos: true,
            max_invitados_evento: true,
            marca_personalizada: true,
            eliminado_en: true,
          },
        },
        creado_en: true,
      },
    });
    if (!user || user.eliminado_en || user.organizacion?.eliminado_en) return null;
    if (user.organizacion && !isOrganizationServiceActive(user.organizacion)) return null;
    if ((session.sessionVersion ?? 0) !== user.session_version) return null;
    if (user.rol === "clienta" && user.organizacion_id === "monarque-clientes-directos" && user.organizacion) {
      user.organizacion.qr_checkin_habilitado = user.lector_qr_habilitado;
    }
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
    priority: "high",
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
