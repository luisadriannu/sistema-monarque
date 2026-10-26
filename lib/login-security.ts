import { createHash } from "crypto";
import prisma from "@/lib/prisma";

const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function getRequestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "unknown";
}

function keyFor(email: string, ip: string) {
  return createHash("sha256").update(`${email}|${ip}`).digest("hex");
}

export async function getLoginAllowance(email: string, ip: string) {
  const record = await prisma.loginIntento.findUnique({ where: { clave: keyFor(email, ip) } });
  const now = new Date();
  if (record?.bloqueado_hasta && record.bloqueado_hasta > now) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((record.bloqueado_hasta.getTime() - now.getTime()) / 1000)) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export async function recordLoginFailure(email: string, ip: string) {
  const clave = keyFor(email, ip);
  const now = new Date();
  const existing = await prisma.loginIntento.findUnique({ where: { clave } });
  const expiredWindow = !existing || now.getTime() - existing.ventana_inicia_en.getTime() > WINDOW_MS;
  const attempts = expiredWindow ? 1 : existing.intentos + 1;
  await prisma.loginIntento.upsert({
    where: { clave },
    create: { clave, intentos: attempts, ventana_inicia_en: now, bloqueado_hasta: attempts >= MAX_ATTEMPTS ? new Date(now.getTime() + BLOCK_MS) : null },
    update: { intentos: attempts, ventana_inicia_en: expiredWindow ? now : existing!.ventana_inicia_en, bloqueado_hasta: attempts >= MAX_ATTEMPTS ? new Date(now.getTime() + BLOCK_MS) : null },
  });
}

export async function clearLoginFailures(email: string, ip: string) {
  await prisma.loginIntento.deleteMany({ where: { clave: keyFor(email, ip) } });
  if (Math.random() < 0.02) {
    await prisma.loginIntento.deleteMany({ where: { actualizado_en: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
  }
}
