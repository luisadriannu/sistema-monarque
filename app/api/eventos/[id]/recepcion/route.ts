import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isOrganizationServiceActive, organizationBlockMessage } from "@/lib/organization-access";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (user?.rol !== "organizador" || !user.organizacion_id || !user.organizacion) return NextResponse.json({ error: "Solo el organizador puede cambiar el estado de recepción." }, { status: 403 });
  if (!isOrganizationServiceActive(user.organizacion)) return NextResponse.json({ error: organizationBlockMessage(user.organizacion) }, { status: 403 });
  if (!user.organizacion.qr_checkin_habilitado) return NextResponse.json({ error: "El acceso QR no está habilitado." }, { status: 403 });
  const { id } = await params;
  const event = await prisma.evento.findFirst({ where: { id, usuario: { organizacion_id: user.organizacion_id, eliminado_en: null } } });
  if (!event) return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  const body = await request.json().catch(() => null);
  const action = body?.action;
  const now = new Date();
  if (action === "abrir") {
    if (["cancelado", "archivado"].includes(event.estado)) return NextResponse.json({ error: "Un evento cancelado o archivado no puede abrir recepción." }, { status: 409 });
    if (event.recepcion_abre_en && now < event.recepcion_abre_en) return NextResponse.json({ error: `La recepción está programada para ${event.recepcion_abre_en.toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}.` }, { status: 409 });
    if (event.recepcion_cierra_en && now > event.recepcion_cierra_en) return NextResponse.json({ error: "La ventana programada de recepción ya finalizó." }, { status: 409 });
    const updated = await prisma.evento.update({ where: { id }, data: { estado: "recepcion_abierta", recepcion_abre_en: event.recepcion_abre_en || now }, select: { id: true, estado: true, recepcion_abre_en: true, recepcion_cierra_en: true } });
    return NextResponse.json({ ok: true, evento: updated, message: "Recepción abierta. Ya se pueden registrar entradas." });
  }
  if (action === "cerrar") {
    const updated = await prisma.evento.update({ where: { id }, data: { estado: "finalizado", recepcion_cierra_en: now }, select: { id: true, estado: true, recepcion_abre_en: true, recepcion_cierra_en: true } });
    return NextResponse.json({ ok: true, evento: updated, message: "Recepción cerrada. El escáner quedó bloqueado." });
  }
  return NextResponse.json({ error: "Acción no válida." }, { status: 400 });
}
