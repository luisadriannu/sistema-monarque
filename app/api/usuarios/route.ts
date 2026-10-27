import { canManageAccounts, accountScope, DIRECT_ORGANIZATION_ID, directOrganizationData } from "@/lib/management-access";
import { isValidName, NAME_ERROR } from "@/lib/names";
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
  return canManageAccounts(user) ? user : null;
}

export async function GET() {
  const organizer = await requireOrganizer();
  if (!organizer) {
    return NextResponse.json(
      { error: "Acceso exclusivo para administradores y organizadores." },
      { status: 403, headers: noStoreHeaders },
    );
  }
  if (organizer.rol !== "admin" && (!organizer.organizacion || !isOrganizationServiceActive(organizer.organizacion))) {
    return NextResponse.json({ error: organizationBlockMessage(organizer.organizacion!) }, { status: 403, headers: noStoreHeaders });
  }

  const all = await prisma.usuario.findMany({
    where: { rol: "clienta", ...accountScope(organizer) },
    select: {
      id: true,
      nombre: true,
      email: true,
      rol: true,
      creado_en: true,
      eliminado_en: true,
      lector_qr_habilitado: true,
      organizacion_id: true,
      organizacion: {
        select: {
          nombre: true,
          max_invitados_evento: true,
          usuarios: {
            where: { rol: "organizador", eliminado_en: null },
            select: { nombre: true },
            take: 1,
          },
        },
      },
      eventos: {
        select: {
          id: true,
          nombre: true,
          anfitriones: true,
          slug: true,
          fecha_evento: true,
          lugar: true,
          capacidad_total: true,
          limite_pases: true,
          fecha_limite_rsvp: true,
          estado: true,
          configuracion_invitacion: true,
          _count: { select: { invitados: true } },
        },
        orderBy: { creado_en: "desc" },
      },
    },
    orderBy: { creado_en: "desc" },
  });

  const usuariosActivos = all.filter(item => !item.eliminado_en);
  const eventosActivos = usuariosActivos.reduce(
    (total, item) => total + (item.eventos || []).filter(evento => !["finalizado", "cancelado", "archivado"].includes(evento.estado)).length,
    0,
  );

  return NextResponse.json({
    usuarios: usuariosActivos,
    eliminados: all.filter(item => Boolean(item.eliminado_en)),
    limites: organizer.rol === "admin" ? null : {
      clientes_usados: usuariosActivos.length,
      clientes_maximos: organizer.organizacion!.max_clientes,
      eventos_usados: eventosActivos,
      eventos_maximos: organizer.organizacion!.max_eventos_activos,
    },
  }, { headers: noStoreHeaders });
}

export async function POST(request: Request) {
  const organizer = await requireOrganizer();
  if (!organizer) {
    return NextResponse.json(
      { error: "Acceso exclusivo para administradores y organizadores." },
      { status: 403, headers: noStoreHeaders },
    );
  }
  if (organizer.rol !== "admin" && (!organizer.organizacion || !isOrganizationServiceActive(organizer.organizacion))) {
    return NextResponse.json({ error: organizationBlockMessage(organizer.organizacion!) }, { status: 403, headers: noStoreHeaders });
  }

  try {
    const body = await request.json();
    const nombre = String(body.nombre || "").trim();
    if (!isValidName(nombre)) return NextResponse.json({ error: NAME_ERROR }, { status: 400 });
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const evento = body.evento || {};
    const nombreEvento = String(evento.nombre || "").trim();
    const anfitriones = String(evento.anfitriones || "").trim();
    if (!isValidName(anfitriones)) return NextResponse.json({ error: "Anfitriones: " + NAME_ERROR }, { status: 400 });
    const slug = normalizeSlug(evento.slug);
    const lugar = String(evento.lugar || "").trim();
    const fechaEvento = new Date(evento.fecha_evento);
    if (Number.isNaN(fechaEvento.getTime())) {
      return NextResponse.json({ error: "La fecha del evento no es válida." }, { status: 400, headers: noStoreHeaders });
    }
    if (fechaEvento.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "La fecha y hora del evento deben ser posteriores al momento actual. Selecciona una fecha y hora futuras.", code: "EVENT_DATE_PAST" },
        { status: 400, headers: noStoreHeaders },
      );
    }
    const fechaLimite = endOfDayMexicoDate(toDateInputValue(fechaEvento));
    const eventType = normalizeEventType(evento.tipo_evento);
    const directPassLimit = organizer.rol === "admin" ? Number(evento.limite_pases || 200) : null;
    if (directPassLimit !== null && (!Number.isInteger(directPassLimit) || directPassLimit < 1)) {
      return NextResponse.json({ error: "El límite contratado debe ser un número entero mayor a cero." }, { status: 400, headers: noStoreHeaders });
    }

    if (organizer.rol !== "admin") {
    const [clientCount, activeEventCount] = await prisma.$transaction([
      prisma.usuario.count({ where: { organizacion_id: organizer.organizacion_id, rol: "clienta", eliminado_en: null } }),
      prisma.evento.count({ where: { usuario: { organizacion_id: organizer.organizacion_id, eliminado_en: null }, estado: { notIn: ["finalizado", "cancelado", "archivado"] } } }),
    ]);
    if (clientCount >= organizer.organizacion!.max_clientes) {
      return NextResponse.json({ error: `Tu capacidad contratada permite hasta ${organizer.organizacion!.max_clientes} clientes activos.` }, { status: 403, headers: noStoreHeaders });
    }
    if (activeEventCount >= organizer.organizacion!.max_eventos_activos) {
      return NextResponse.json({ error: `Tu capacidad contratada permite hasta ${organizer.organizacion!.max_eventos_activos} eventos activos.` }, { status: 403, headers: noStoreHeaders });
    }

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
    const emailExists = await prisma.usuario.findUnique({ where: { email }, select: { id: true } });
    if (emailExists) return NextResponse.json(
      { error: "El correo electrónico ya está registrado. Utiliza otro correo.", code: "EMAIL_TAKEN" },
      { status: 409, headers: noStoreHeaders },
    );

    const passwordHash = await bcrypt.hash(password, 12);
    const createAccount = (availableSlug: string) => prisma.$transaction(async (tx) => {
      if (organizer.rol === "admin") {
        await tx.organizacion.upsert({ where: { id: DIRECT_ORGANIZATION_ID }, create: directOrganizationData, update: {} });
      }
      const usuario = await tx.usuario.create({
        data: { nombre, email, passwordHash, rol: "clienta", lector_qr_habilitado: organizer.rol === "admin" && body.qr_checkin_habilitado === true, organizacion_id: organizer.rol === "admin" ? DIRECT_ORGANIZATION_ID : organizer.organizacion_id },
        select: { id: true, nombre: true, email: true, rol: true },
      });
      const nuevoEvento = await tx.evento.create({
        data: {
          usuario_id: usuario.id,
          nombre: nombreEvento,
          anfitriones,
          slug: availableSlug,
          modo_ingreso: "parcial",
          fecha_evento: fechaEvento,
          lugar,
          capacidad_total: null,
          limite_pases: directPassLimit,
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

    // La unicidad del enlace es global, también entre organizaciones.
    // Si otra petición ocupa el candidato al guardarlo, se reintenta toda la
    // transacción para no dejar una cuenta sin evento.
    let availableSlug = slug;
    let suffix = 2;
    let created: Awaited<ReturnType<typeof createAccount>> | undefined;
    for (let attempt = 0; attempt < 5; attempt++) {
      while (await prisma.evento.findUnique({ where: { slug: availableSlug }, select: { id: true } })) {
        availableSlug = `${slug}-${suffix++}`;
      }
      try {
        created = await createAccount(availableSlug);
        break;
      } catch (error) {
        const target = error instanceof Prisma.PrismaClientKnownRequestError ? String(error.meta?.target ?? "") : "";
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002" || !target.includes("slug")) throw error;
        availableSlug = `${slug}-${suffix++}`;
      }
    }
    if (!created) return NextResponse.json(
      { error: "El enlace del evento ya está registrado y se está reservando en otra solicitud. Intenta guardar nuevamente.", code: "SLUG_TAKEN" },
      { status: 409, headers: noStoreHeaders },
    );

    return NextResponse.json(
      { ok: true, ...created, ...(availableSlug !== slug ? {
        message: `El enlace del evento /${slug} ya está registrado. Se asignó automáticamente /${availableSlug}. La clienta y su evento se crearon correctamente.`,
      } : {}) },
      { status: 201, headers: noStoreHeaders },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "El correo electrónico ya está registrado. Utiliza otro correo.", code: "EMAIL_TAKEN" },
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
