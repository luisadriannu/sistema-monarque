import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@/generated/prisma-client";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

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

const invitationThemes = {
  romantic: {
    primary: "#743C53",
    secondary: "#EBD8D9",
    accent: "#C68972",
    background: "#FAF3F1",
  },
  botanical: {
    primary: "#405847",
    secondary: "#DDE3D4",
    accent: "#AA8255",
    background: "#F3F2E9",
  },
  midnight: {
    primary: "#24324A",
    secondary: "#D9DEE8",
    accent: "#B39255",
    background: "#EEEFF2",
  },
} as const;

type InvitationTheme = keyof typeof invitationThemes;

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await getCurrentUser();
  if (!admin || admin.rol !== "admin") {
    return NextResponse.json(
      { error: "Acceso exclusivo para administradores." },
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
        eventos: {
          select: { id: true, configuracion_invitacion: true },
        },
      },
    });

    if (!existing || existing.rol !== "clienta") {
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
    if (password && password.length < 8) {
      return NextResponse.json(
        { error: "La nueva contraseña debe tener al menos 8 caracteres." },
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
    const fechaLimite = new Date(evento.fecha_limite_rsvp);
    const requestedTheme = String(evento.tema || "romantic");
    const theme: InvitationTheme =
      requestedTheme in invitationThemes
        ? (requestedTheme as InvitationTheme)
        : "romantic";
    const phrase = String(evento.frase || "").trim();
    const dressCode = String(evento.vestimenta || "").trim();
    const capacidad =
      evento.capacidad_total === "" || evento.capacidad_total == null
        ? null
        : Number(evento.capacidad_total);

    if (!nombreEvento || !anfitriones || !slug || !lugar) {
      return NextResponse.json(
        { error: "Completa todos los datos obligatorios del evento." },
        { status: 400, headers: noStoreHeaders },
      );
    }
    if (Number.isNaN(fechaEvento.getTime()) || Number.isNaN(fechaLimite.getTime())) {
      return NextResponse.json(
        { error: "Las fechas del evento no son válidas." },
        { status: 400, headers: noStoreHeaders },
      );
    }
    if (fechaLimite > fechaEvento) {
      return NextResponse.json(
        { error: "La fecha límite debe ser anterior al evento." },
        { status: 400, headers: noStoreHeaders },
      );
    }
    if (capacidad !== null && (!Number.isInteger(capacidad) || capacidad < 1)) {
      return NextResponse.json(
        { error: "La capacidad debe ser un entero mayor que cero." },
        { status: 400, headers: noStoreHeaders },
      );
    }

    const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;
    const storedConfig = isRecord(existingEvent.configuracion_invitacion)
      ? existingEvent.configuracion_invitacion
      : {};
    const storedEvent = isRecord(storedConfig.event) ? storedConfig.event : {};
    const storedLocation = isRecord(storedConfig.location)
      ? storedConfig.location
      : {};
    const updatedConfig = {
      ...storedConfig,
      event: {
        ...storedEvent,
        name: anfitriones.replace(/\s+y\s+/i, " & "),
        date: fechaEvento.toISOString(),
        phrase:
          phrase ||
          "Con mucha ilusión queremos compartir contigo este día tan especial.",
        dressCode,
      },
      location: {
        ...storedLocation,
        reception: lugar,
      },
      design: {
        variant: theme,
        colors: invitationThemes[theme],
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
          fecha_limite_rsvp: fechaLimite,
          capacidad_total: capacidad,
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
