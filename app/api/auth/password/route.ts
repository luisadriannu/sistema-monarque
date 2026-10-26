import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { clearSessionCookie, getCurrentUser } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const actual = typeof body?.password_actual === "string" ? body.password_actual : "";
  const nueva = typeof body?.password_nueva === "string" ? body.password_nueva : "";
  if (!actual || nueva.length < 10) {
    return NextResponse.json({ error: "La nueva contraseña debe tener al menos 10 caracteres." }, { status: 400 });
  }
  const stored = await prisma.usuario.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!stored || !(await bcrypt.compare(actual, stored.passwordHash))) {
    return NextResponse.json({ error: "La contraseña actual no es correcta." }, { status: 400 });
  }
  if (await bcrypt.compare(nueva, stored.passwordHash)) {
    return NextResponse.json({ error: "La nueva contraseña debe ser diferente a la actual." }, { status: 400 });
  }
  await prisma.usuario.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(nueva, 12), session_version: { increment: 1 } },
  });
  await clearSessionCookie();
  return NextResponse.json({ ok: true, message: "Contraseña actualizada. Inicia sesión nuevamente." });
}
