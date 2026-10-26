import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@/generated/prisma-client-v3";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  eventTypeThemes,
  getEventTypeFromConfig,
  normalizeEventType,
} from "@/lib/event-theme";

const noStoreHeaders = { "Cache-Control": "no-store" };

function normalizeSlug(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const organizer = await getCurrentUser();
  if (!organizer || organizer.rol !== "organizador" || !organizer.organizacion_id) {
    return NextResponse.json(
      { error: "Acceso exclusivo para organizadores." },
      { status: 403, headers: noStoreHeaders },
    );
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const existing = await prisma.usuario.findUnique({
      where: { id },
      select: {
        rol: true,
        organizacion_id: true,
        eliminado_en: true,
        eventos: {
          select: { id: true, configuracion_invitacion: true },
        },
      },
    });

    if (!existing || existing.eliminado_en || existing.rol !== "clienta" || existing.organizacion_id !== organizer.organizacion_id) {
      return NextResponse.json(
        { error: "La cuenta de la clienta no existe." },
        { status: 404, headers: noStoreHeaders },
      );
    }

    const nombre = String(body.nombre || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const evento = body.evento || {};
    const eventId = String(evento.id || "");

    if (!nombre || !email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Ingresa un nombre y un correo válido." },
        { status: 400, headers: noStoreHeaders },
      );
    }
    if (password && password.length < 10) {
      return NextResponse.json(
        { error: "La nueva contraseña debe tener al menos 10 caracteres." },
        { status: 400, headers: noStoreHeaders },
      );
    }
    const existingEvent = existing.eventos.find((item) => item.id === eventId);
    if (!existingEvent) {
      return NextResponse.json(
        { error: "El evento no pertenece a esta clienta." },
        { status: 400, headers: noStoreHeaders },
      );
    }

    const nombreEvento = String(evento.nombre || "").trim();
    const anfitriones = String(evento.anfitriones || "").trim();
    const slug = normalizeSlug(evento.slug);
    const lugar = String(evento.lugar || "").trim();
    const fechaEvento = new Date(evento.fecha_evento);

    if (!nombreEvento || !anfitriones || !slug || !lugar) {
      return NextResponse.json(
        { error: "Completa todos los datos obligatorios del evento." },
        { status: 400, headers: noStoreHeaders },
      );
    }
    if (Number.isNaN(fechaEvento.getTime())) {
      return NextResponse.json(
        { error: "La fecha del evento no es válida." },
        { status: 400, headers: noStoreHeaders },
      );
    }

    const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;
    const storedConfig = isRecord(existingEvent.configuracion_invitacion)
      ? existingEvent.configuracion_invitacion
      : {};
    const eventType = normalizeEventType(
      evento.tipo_evento,
      getEventTypeFromConfig(storedConfig),
    );
    const storedEvent = isRecord(storedConfig.event) ? storedConfig.event : {};
    const storedLocation = isRecord(storedConfig.location)
      ? storedConfig.location
      : {};
    const storedSystem = isRecord(storedConfig.system)
      ? storedConfig.system
      : {};
    const updatedConfig = {
      ...storedConfig,
      tipo: eventType,
      event: {
        ...storedEvent,
        name: anfitriones.replace(/\s+y\s+/i, " & "),
        date: fechaEvento.toISOString(),
      },
      location: {
        ...storedLocation,
        reception: lugar,
      },
      system: {
        ...storedSystem,
        eventType,
        colors: eventTypeThemes[eventType],
      },
    } as Prisma.InputJsonValue;

    await prisma.$transaction([
      prisma.usuario.update({
        where: { id },
        data: {
          nombre,
          email,
          ...(passwordHash ? { passwordHash } : {}),
        },
      }),
      prisma.evento.update({
        where: { id: eventId },
        data: {
          nombre: nombreEvento,
          anfitriones,
          slug,
          lugar,
          fecha_evento: fechaEvento,
          configuracion_invitacion: updatedConfig,
        },
      }),
    ]);

    return NextResponse.json(
      { ok: true, message: "Cuenta actualizada correctamente." },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "El correo o el enlace del evento ya están registrados." },
        { status: 409, headers: noStoreHeaders },
      );
    }
    console.error("Error al actualizar clienta", error);
    return NextResponse.json(
      { error: "No se pudo actualizar la cuenta." },
      { status: 500, headers: noStoreHeaders },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const organizer = await getCurrentUser();
  if (!organizer || organizer.rol !== "organizador" || !organizer.organizacion_id) {
    return NextResponse.json({ error: "Acceso exclusivo para organizadores." }, { status: 403, headers: noStoreHeaders });
  }
  const body = await request.json().catch(() => null);
  if (body?.action !== "restaurar") return NextResponse.json({ error: "Acción no válida." }, { status: 400, headers: noStoreHeaders });
  const { id } = await params;
  const client = await prisma.usuario.findFirst({ where: { id, rol: "clienta", organizacion_id: organizer.organizacion_id }, select: { id: true } });
  if (!client) return NextResponse.json({ error: "La cuenta no existe." }, { status: 404, headers: noStoreHeaders });
  await prisma.usuario.update({ where: { id }, data: { eliminado_en: null, session_version: { increment: 1 } } });
  return NextResponse.json({ ok: true, message: "Cliente restaurado correctamente." }, { headers: noStoreHeaders });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const organizer = await getCurrentUser();
  if (!organizer || organizer.rol !== "organizador" || !organizer.organizacion_id) {
    return NextResponse.json(
      { error: "Acceso exclusivo para organizadores." },
      { status: 403, headers: noStoreHeaders },
    );
  }

  const { id } = await params;

  try {
    const cliente = await prisma.usuario.findUnique({
      where: { id },
      select: { id: true, nombre: true, rol: true, organizacion_id: true },
    });

    if (!cliente || cliente.rol !== "clienta" || cliente.organizacion_id !== organizer.organizacion_id) {
      return NextResponse.json(
        { error: "La cuenta de la clienta no existe." },
        { status: 404, headers: noStoreHeaders },
      );
    }

    // Evento e invitados se eliminan mediante las relaciones onDelete: Cascade
    // definidas en Prisma, manteniendo la operación atómica en PostgreSQL.
    await prisma.usuario.update({ where: { id: cliente.id }, data: { eliminado_en: new Date(), session_version: { increment: 1 } } });

    return NextResponse.json(
      {
        ok: true,
        message: `La cuenta de ${cliente.nombre} se movió a la papelera. Sus eventos e invitados se conservaron.`,
      },
      { headers: noStoreHeaders },
    );
  } catch (error) {
    console.error("Error al eliminar clienta", error);
    return NextResponse.json(
      { error: "No se pudo eliminar la cuenta de la clienta." },
      { status: 500, headers: noStoreHeaders },
    );
  }
}
