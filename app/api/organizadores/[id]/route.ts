import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const headers = { "Cache-Control": "no-store" };

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentUser();
  if (admin?.rol !== "admin") return NextResponse.json({ error: "Acceso denegado." }, { status: 403, headers });
  const { id } = await params;
  const body = await request.json();
  const nombre = String(body.nombre || "").trim();
  const negocio = String(body.negocio || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!nombre || !negocio || !email.includes("@")) return NextResponse.json({ error: "Datos incompletos." }, { status: 400, headers });
  if (password && password.length < 8) return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400, headers });

  const organizer = await prisma.usuario.findFirst({ where: { organizacion_id: id, rol: "organizador" }, select: { id: true } });
  if (!organizer) return NextResponse.json({ error: "Organizador no encontrado." }, { status: 404, headers });
  await prisma.$transaction([
    prisma.organizacion.update({ where: { id }, data: { nombre: negocio, qr_checkin_habilitado: Boolean(body.qr_checkin_habilitado) } }),
    prisma.usuario.update({ where: { id: organizer.id }, data: { nombre, email, ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}) } }),
  ]);
  return NextResponse.json({ ok: true }, { headers });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentUser();
  if (admin?.rol !== "admin") return NextResponse.json({ error: "Acceso denegado." }, { status: 403, headers });
  const { id } = await params;
  const organization = await prisma.organizacion.findUnique({ where: { id }, select: { nombre: true } });
  if (!organization) return NextResponse.json({ error: "Organizador no encontrado." }, { status: 404, headers });
  await prisma.organizacion.delete({ where: { id } });
  return NextResponse.json({ ok: true, message: `${organization.nombre} y sus datos fueron eliminados.` }, { headers });
}
