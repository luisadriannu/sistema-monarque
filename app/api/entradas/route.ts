import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const headers = { "Cache-Control": "no-store" };

async function authorizedOrganizer() {
  const user = await getCurrentUser();
  if (user?.rol !== "organizador" || !user.organizacion_id || !user.organizacion?.qr_checkin_habilitado) return null;
  return user;
}

const guestSelect = {
  id: true, nombre: true, grupo: true, pases_asignados: true, pases_confirmados: true,
  pases_ingresados: true, estado: true, evento: { select: { id: true, nombre: true, anfitriones: true, usuario: { select: { organizacion_id: true } } } },
} as const;

export async function GET(request: Request) {
  const user = await authorizedOrganizer();
  if (!user) return NextResponse.json({ error: "El acceso QR no está habilitado." }, { status: 403, headers });
  const code = new URL(request.url).searchParams.get("codigo")?.replace(/^monarque:entrada:/, "").trim();
  if (code) {
    const invitado = await prisma.invitado.findUnique({ where: { codigo_entrada: code }, select: guestSelect });
    if (!invitado || invitado.evento.usuario.organizacion_id !== user.organizacion_id) return NextResponse.json({ error: "Código no válido para tu organización." }, { status: 404, headers });
    return NextResponse.json({ invitado }, { headers });
  }
  const registros = await prisma.registroEntrada.findMany({
    where: { evento: { usuario: { organizacion_id: user.organizacion_id } } },
    include: { invitado: { select: { nombre: true, grupo: true } }, evento: { select: { nombre: true } } },
    orderBy: { creado_en: "desc" }, take: 100,
  });
  return NextResponse.json({ registros }, { headers });
}

export async function POST(request: Request) {
  const user = await authorizedOrganizer();
  if (!user) return NextResponse.json({ error: "El acceso QR no está habilitado." }, { status: 403, headers });
  const body = await request.json();
  const code = String(body.codigo || "").replace(/^monarque:entrada:/, "").trim();
  const cantidad = Number(body.cantidad);
  if (!Number.isInteger(cantidad) || cantidad < 1) return NextResponse.json({ error: "Indica una cantidad válida." }, { status: 400, headers });

  try {
    const result = await prisma.$transaction(async tx => {
      const invitado = await tx.invitado.findUnique({ where: { codigo_entrada: code }, select: guestSelect });
      if (!invitado || invitado.evento.usuario.organizacion_id !== user.organizacion_id) throw new Error("INVALID_CODE");
      const limite = invitado.pases_confirmados ?? invitado.pases_asignados;
      if (invitado.estado === "declinado") throw new Error("DECLINED");
      if (invitado.pases_ingresados + cantidad > limite) throw new Error("CAPACITY");
      const updated = await tx.invitado.update({ where: { id: invitado.id }, data: { pases_ingresados: { increment: cantidad }, ultima_entrada_en: new Date() }, select: { pases_ingresados: true } });
      await tx.registroEntrada.create({ data: { invitado_id: invitado.id, evento_id: invitado.evento.id, escaneado_por_id: user.id, cantidad } });
      return { ...invitado, pases_ingresados: updated.pases_ingresados };
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ ok: true, invitado: result }, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (typeof error === "object" && error && "code" in error && error.code === "P2034") {
      return NextResponse.json({ error: "El pase se está registrando en otro dispositivo. Escanéalo nuevamente." }, { status: 409, headers });
    }
    const response = message === "CAPACITY" ? ["Ese QR ya alcanzó el total de accesos permitidos.", 409] : message === "DECLINED" ? ["Este invitado declinó la invitación.", 409] : ["El código no es válido para tu organización.", 404];
    return NextResponse.json({ error: response[0] }, { status: Number(response[1]), headers });
  }
}
