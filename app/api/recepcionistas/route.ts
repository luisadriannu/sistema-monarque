import { canManageAccounts, accountScope } from "@/lib/management-access";
import { receptionOrganization } from "@/lib/reception-access";
import { hasClientQr } from "@/lib/qr-access";
import { isValidName, NAME_ERROR } from "@/lib/names";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@/generated/prisma-client-v3";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isOrganizationServiceActive, organizationBlockMessage } from "@/lib/organization-access";

const headers = { "Cache-Control": "no-store" };
const organizerNames = { where: { rol: "organizador", eliminado_en: null }, select: { nombre: true }, take: 1 } as const;

async function organizer() {
  const user = await getCurrentUser();
  return canManageAccounts(user) ? user : null;
}

export async function GET() {
  const user = await organizer();
  if (!user) return NextResponse.json({ error: "Acceso exclusivo para administradores y organizadores." }, { status: 403, headers });
  const [recepcionistas, eventos] = await prisma.$transaction([
    prisma.usuario.findMany({
      where: { ...accountScope(user), rol: "recepcionista" },
      select: { id: true, nombre: true, email: true, eliminado_en: true, organizacion_id: true, organizacion: { select: { nombre: true, usuarios: organizerNames } }, eventos_recepcion: { select: { evento: { select: { id: true, nombre: true, fecha_evento: true, estado: true } } } } },
      orderBy: { creado_en: "desc" },
    }),
    prisma.evento.findMany({
      where: { usuario: { ...accountScope(user), eliminado_en: null }, estado: { not: "archivado" } },
      select: { id: true, nombre: true, fecha_evento: true, estado: true, usuario: { select: { organizacion_id: true, lector_qr_habilitado: true, organizacion: { select: { nombre: true, qr_checkin_habilitado: true, usuarios: organizerNames } } } } },
      orderBy: { fecha_evento: "desc" },
    }),
  ]);
  return NextResponse.json({ recepcionistas, eventos: eventos.filter(event => hasClientQr(event.usuario)) }, { headers });
}

export async function POST(request: Request) {
  const user = await organizer();
  if (!user) return NextResponse.json({ error: "Acceso exclusivo para administradores y organizadores." }, { status: 403, headers });
  if (user.rol !== "admin" && (!user.organizacion || !isOrganizationServiceActive(user.organizacion))) return NextResponse.json({ error: organizationBlockMessage(user.organizacion!) }, { status: 403, headers });
  if (user.rol !== "admin" && !user.organizacion?.qr_checkin_habilitado) return NextResponse.json({ error: "Tu plan no tiene habilitado el control de acceso QR." }, { status: 403, headers });
  const body = await request.json().catch(() => null);
  const nombre = String(body?.nombre || "").trim();
    if (!isValidName(nombre)) return NextResponse.json({ error: NAME_ERROR }, { status: 400 });
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  const eventIds: string[] = Array.isArray(body?.evento_ids) ? [...new Set<string>(body.evento_ids.map((value: unknown) => String(value)))] : [];
  if (!nombre || !email.includes("@") || password.length < 10 || !eventIds.length) return NextResponse.json({ error: "Completa los datos, usa una contraseña de 10 caracteres y asigna al menos un evento." }, { status: 400, headers });
  const organizationId = await receptionOrganization(eventIds, user);
  if (!organizationId) return NextResponse.json({ error: "Selecciona eventos permitidos de una misma organización o de Clientes directos." }, { status: 403, headers });
  try {
    const created = await prisma.usuario.create({
      data: {
        nombre, email, passwordHash: await bcrypt.hash(password, 12), rol: "recepcionista", organizacion_id: organizationId, lector_qr_habilitado: true,
        eventos_recepcion: { create: eventIds.map(evento_id => ({ evento_id })) },
      },
      select: { id: true, nombre: true, email: true },
    });
    return NextResponse.json({ ok: true, recepcionista: created }, { status: 201, headers });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "Ese correo ya está registrado." }, { status: 409, headers });
    return NextResponse.json({ error: "No se pudo crear la cuenta de recepción." }, { status: 500, headers });
  }
}
