import { canManageAccounts, accountScope } from "@/lib/management-access";
import { receptionOrganization } from "@/lib/reception-access";
import { isValidName, NAME_ERROR } from "@/lib/names";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const headers = { "Cache-Control": "no-store" };

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!canManageAccounts(user)) return NextResponse.json({ error: "Acceso denegado." }, { status: 403, headers });
  const { id } = await params;
  const target = await prisma.usuario.findFirst({ where: { id, rol: "recepcionista", ...accountScope(user) }, select: { id: true } });
  if (!target) return NextResponse.json({ error: "Cuenta no encontrada." }, { status: 404, headers });
  const body = await request.json().catch(() => null);
  const nombre = String(body?.nombre || "").trim();
    if (!isValidName(nombre)) return NextResponse.json({ error: NAME_ERROR }, { status: 400 });
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  const eventIds: string[] = Array.isArray(body?.evento_ids) ? [...new Set<string>(body.evento_ids.map((value: unknown) => String(value)))] : [];
  if (!nombre || !email.includes("@") || (password && password.length < 10) || !eventIds.length) return NextResponse.json({ error: "Revisa los datos y asigna al menos un evento." }, { status: 400, headers });
  const organizationId = await receptionOrganization(eventIds, user);
  if (!organizationId) return NextResponse.json({ error: "Selecciona eventos permitidos de una misma organización o de Clientes directos." }, { status: 403, headers });
  await prisma.$transaction(async tx => {
    await tx.eventoRecepcionista.deleteMany({ where: { usuario_id: id } });
    await tx.usuario.update({ where: { id }, data: { nombre, email, organizacion_id: organizationId, eliminado_en: null, lector_qr_habilitado: true, session_version: { increment: 1 }, ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}), eventos_recepcion: { create: eventIds.map(evento_id => ({ evento_id })) } } });
  });
  return NextResponse.json({ ok: true }, { headers });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!canManageAccounts(user)) return NextResponse.json({ error: "Acceso denegado." }, { status: 403, headers });
  const { id } = await params;
  const target = await prisma.usuario.findFirst({ where: { id, rol: "recepcionista", ...accountScope(user) }, select: { id: true, nombre: true } });
  if (!target) return NextResponse.json({ error: "Cuenta no encontrada." }, { status: 404, headers });
  await prisma.usuario.update({ where: { id }, data: { eliminado_en: new Date(), lector_qr_habilitado: false, session_version: { increment: 1 } } });
  return NextResponse.json({ ok: true, message: `${target.nombre} ya no puede ingresar al sistema.` }, { headers });
}
