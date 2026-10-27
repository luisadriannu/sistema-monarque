import { canManageAccounts, accountScope } from "@/lib/management-access";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!canManageAccounts(user)) return NextResponse.json({ error: "Solo el administrador o el organizador pueden corregir una entrada." }, { status: 403 });
  const { id } = await params;
  const guest = await prisma.invitado.findFirst({ where: { id, evento: { usuario: accountScope(user) } }, select: { id: true, nombre: true } });
  if (!guest) return NextResponse.json({ error: "Invitado no encontrado." }, { status: 404 });
  await prisma.$transaction([
    prisma.registroEntrada.deleteMany({ where: { invitado_id: id } }),
    prisma.invitado.update({ where: { id }, data: { pases_ingresados: 0, ultima_entrada_en: null, escaneado_en: null, escaneado_por: null } }),
  ]);
  return NextResponse.json({ ok: true, message: `La entrada de ${guest.nombre} fue revertida y su QR vuelve a estar disponible.` });
}
