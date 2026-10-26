import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@/generated/prisma-client-v3";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { endOfDayMexicoDate, toDateInputValue } from "@/lib/utils";
import {
  eventTypeThemes,
  genericInvitationTheme,
  normalizeEventType,
  type EventType,
} from "@/lib/event-theme";
import { isOrganizationServiceActive, organizationBlockMessage } from "@/lib/organization-access";

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

async function requireOrganizer() {
  const user = await getCurrentUser();
  return user?.rol === "organizador" && user.organizacion_id && user.organizacion ? user : null;
}

export async function GET() {
  const organizer = await requireOrganizer();
  if (!organizer) {
    return NextResponse.json(
      { error: "Acceso exclusivo para organizadores." },
      { status: 403, headers: noStoreHeaders },
    );
  }
  if (!isOrganizationServiceActive(organizer.organizacion!)) {
    return NextResponse.json({ error: organizationBlockMessage(organizer.organizacion!) }, { status: 403, headers: noStoreHeaders });
  }

  const all = await prisma.usuario.findMany({
    where: { rol: "clienta", organizacion_id: organizer.organizacion_id },
    select: {
      id: true,
      nombre: true,
      email: true,
      rol: true,
      creado_en: true,
      eliminado_en: true,
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

  return NextResponse.json({
    usuarios: all.filter(item => !item.eliminado_en),
    eliminados: all.filter(item => Boolean(item.eliminado_en)),
  }, { headers: noStoreHeaders });
}

export async function POST(request: Request) {
  const organizer = await requireOrganizer();
  if (!organizer) {
    return NextResponse.json(
      { error: "Acceso exclusivo para organizadores." },
      { status: 403, headers: noStoreHeaders },
    );
  }
  if (!isOrganizationServiceActive(organizer.organizacion!)) {
    return NextResponse.json({ error: organizationBlockMessage(organizer.organizacion!) }, { status: 403, headers: noStoreHeaders });
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

    const [clientCount, activeEventCount] = await prisma.$transaction([
      prisma.usuario.count({ where: { organizacion_id: organizer.organizacion_id, rol: "clienta", eliminado_en: null } }),
      prisma.evento.count({ where: { usuario: { organizacion_id: organizer.organizacion_id, eliminado_en: null }, estado: { notIn: ["finalizado", "cancelado", "archivado"] } } }),
    ]);
    if (clientCount >= organizer.organizacion!.max_clientes) {
      return NextResponse.json({ error: `Tu plan permite hasta ${organizer.organizacion!.max_clientes} clientes activos.` }, { status: 403, headers: noStoreHeaders });
    }
    if (activeEventCount >= organizer.organizacion!.max_eventos_activos) {
      return NextResponse.json({ error: `Tu plan permite hasta ${organizer.organizacion!.max_eventos_activos} eventos activos.` }, { status: 403, headers: noStoreHeaders });
    }

    if (!nombre || !email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Ingresa un nombre y un correo válido." },
        { status: 400, headers: noStoreHeaders },
      );
    }
    if (password.length < 10) {
      return NextResponse.json(
        { error: "La contraseña debe tener al menos 10 caracteres." },
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
        data: { nombre, email, passwordHash, rol: "clienta", organizacion_id: organizer.organizacion_id },
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
