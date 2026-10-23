import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@/generated/prisma-client";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { endOfDayMexicoDate, toDateInputValue } from "@/lib/utils";
import {
  eventTypeThemes,
  genericInvitationTheme,
  normalizeEventType,
  type EventType,
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

function invitationConfig(data: {
  anfitriones: string;
  fechaEvento: Date;
  lugar: string;
  eventType: EventType;
}) {
  const systemTheme = eventTypeThemes[data.eventType];

  return {
    tipo: data.eventType,
    plan: "elite",
    seo: {
      title: `Invitación de ${data.anfitriones}`,
      description: `Acompáñanos a celebrar este momento especial con ${data.anfitriones}.`,
    },
    event: {
      name: data.anfitriones.replace(/\s+y\s+/i, " & "),
      date: data.fechaEvento.toISOString(),
      startsAt: new Intl.DateTimeFormat("es-MX", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "America/Mexico_City",
      }).format(data.fechaEvento),
      phrase: "Nos encantará compartir contigo este momento especial.",
      dressCode: "",
      itinerary: [],
    },
    location: {
      event: "Lugar del evento",
      reception: data.lugar,
    },
    contact: { phone: "" },
    family: {
      groomParents: { father: "", mother: "" },
      brideParents: { father: "", mother: "" },
    },
    system: {
      eventType: data.eventType,
      colors: systemTheme,
    },
    design: {
      variant: "generic",
      colors: genericInvitationTheme,
    },
  };
}

async function requireAdmin() {
  const user = await getCurrentUser();
  return user?.rol === "admin" ? user : null;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "Acceso exclusivo para administradores." },
      { status: 403, headers: noStoreHeaders },
    );
  }

  const usuarios = await prisma.usuario.findMany({
    where: { rol: "clienta" },
    select: {
      id: true,
      nombre: true,
      email: true,
      rol: true,
      creado_en: true,
      eventos: {
        select: {
          id: true,
          nombre: true,
          anfitriones: true,
          slug: true,
          fecha_evento: true,
          lugar: true,
          capacidad_total: true,
          fecha_limite_rsvp: true,
          configuracion_invitacion: true,
          _count: { select: { invitados: true } },
        },
        orderBy: { creado_en: "desc" },
      },
    },
    orderBy: { creado_en: "desc" },
  });

  return NextResponse.json({ usuarios }, { headers: noStoreHeaders });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "Acceso exclusivo para administradores." },
      { status: 403, headers: noStoreHeaders },
    );
  }

  try {
    const body = await request.json();
    const nombre = String(body.nombre || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const evento = body.evento || {};
    const nombreEvento = String(evento.nombre || "").trim();
    const anfitriones = String(evento.anfitriones || "").trim();
    const slug = normalizeSlug(evento.slug);
    const lugar = String(evento.lugar || "").trim();
    const fechaEvento = new Date(evento.fecha_evento);
    const fechaLimite = endOfDayMexicoDate(toDateInputValue(fechaEvento));
    const eventType = normalizeEventType(evento.tipo_evento);

    if (!nombre || !email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Ingresa un nombre y un correo válido." },
        { status: 400, headers: noStoreHeaders },
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 8 caracteres." },
        { status: 400, headers: noStoreHeaders },
      );
    }
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

    const passwordHash = await bcrypt.hash(password, 12);
    const created = await prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: { nombre, email, passwordHash, rol: "clienta" },
        select: { id: true, nombre: true, email: true, rol: true },
      });
      const nuevoEvento = await tx.evento.create({
        data: {
          usuario_id: usuario.id,
          nombre: nombreEvento,
          anfitriones,
          slug,
          fecha_evento: fechaEvento,
          lugar,
          capacidad_total: null,
          fecha_limite_rsvp: fechaLimite,
          configuracion_invitacion: invitationConfig({
            anfitriones,
            fechaEvento,
            lugar,
            eventType,
          }),
        },
        select: { id: true, nombre: true, slug: true },
      });
      return { usuario, evento: nuevoEvento };
    });

    return NextResponse.json(
      { ok: true, ...created },
      { status: 201, headers: noStoreHeaders },
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
    console.error("Error al crear clienta", error);
    return NextResponse.json(
      { error: "No se pudo crear la cuenta." },
      { status: 500, headers: noStoreHeaders },
    );
  }
}
