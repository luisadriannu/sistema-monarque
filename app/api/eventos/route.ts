import { isValidName, NAME_ERROR } from "@/lib/names";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isEventFinished, toDateInputValue, toDateTimeInputValue } from "@/lib/utils";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  // RF-02: Cada clienta solo puede ver los datos de su propio evento.
  const whereClause = user.rol === "admin" ? {} : { usuario_id: user.id };
  const eventId = new URL(request.url).searchParams.get("evento_id");

  const eventos = await prisma.evento.findMany({
    where: { ...whereClause, ...(eventId ? { id: eventId } : {}) },
    include: {
      _count: {
        select: { invitados: true },
      },
    },
    orderBy: { creado_en: "desc" },
  });

  return NextResponse.json({
    eventos,
    permisos: {
      qr_checkin_habilitado: user.rol === "admin" || Boolean(user.organizacion?.qr_checkin_habilitado),
      administrador: user.rol === "admin",
    },
  });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const data = await request.json();
    const {
      id,
      nombre,
      anfitriones,
      fecha_evento,
      lugar,
      capacidad_total,
      fecha_limite_rsvp,
      texto_edad_nino,
      plantilla_mensaje,
      plantilla_recordatorio,
      slug,
      estado,
      recepcion_abre_en,
      recepcion_cierra_en,
      modo_ingreso,
    } = data;

    if (!id) {
      return NextResponse.json({ error: "ID del evento requerido." }, { status: 400 });
    }

    if (anfitriones !== undefined && !isValidName(anfitriones)) return NextResponse.json({ error: "Anfitriones: " + NAME_ERROR }, { status: 400 });

    // Verificar pertenencia (RF-02)
    const existing = await prisma.evento.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
    }

    if (user.rol !== "admin" && existing.usuario_id !== user.id) {
      return NextResponse.json(
        { error: "No tienes permiso para modificar este evento." },
        { status: 403 }
      );
    }

    if (user.rol !== "admin" && isEventFinished(existing.fecha_evento)) {
      return NextResponse.json(
        {
          error:
            "El evento ya finalizó. La configuración se encuentra disponible únicamente para consulta.",
        },
        { status: 403 },
      );
    }

    const targetEventDate = fecha_evento
      ? new Date(fecha_evento)
      : existing.fecha_evento;
    const targetDeadline = fecha_limite_rsvp
      ? new Date(fecha_limite_rsvp)
      : existing.fecha_limite_rsvp;

    const allowedClientStates = ["borrador", "publicado", "cancelado", "archivado"];
    const nextState = estado && allowedClientStates.includes(estado) ? estado : undefined;
    const nextEntryMode = user.rol === "clienta" ? "parcial" : modo_ingreso === "parcial" ? "parcial" : modo_ingreso === "unico" ? "unico" : undefined;
    if (user.rol === "clienta" && (recepcion_abre_en !== undefined || recepcion_cierra_en !== undefined)) {
      return NextResponse.json({ error: "Solo el administrador o el organizador pueden configurar la recepción." }, { status: 403 });
    }
    const receptionOpens = recepcion_abre_en ? new Date(recepcion_abre_en) : recepcion_abre_en === null ? null : undefined;
    const receptionCloses = recepcion_cierra_en ? new Date(recepcion_cierra_en) : recepcion_cierra_en === null ? null : undefined;
    if (receptionOpens instanceof Date && Number.isNaN(receptionOpens.getTime()) || receptionCloses instanceof Date && Number.isNaN(receptionCloses.getTime())) {
      return NextResponse.json({ error: "La ventana de recepción no es válida." }, { status: 400 });
    }
    const now = Date.now();
    for (const [value, original, label] of [
      [receptionOpens, existing.recepcion_abre_en, "apertura"],
      [receptionCloses, existing.recepcion_cierra_en, "cierre"],
    ] as const) {
      if (value && value.getTime() <= now && toDateTimeInputValue(value) !== toDateTimeInputValue(original)) {
        return NextResponse.json({ error: `La fecha y hora de ${label} programado deben ser futuras.`, code: "RECEPTION_DATE_PAST" }, { status: 400 });
      }
    }
    const effectiveOpens = receptionOpens === undefined ? existing.recepcion_abre_en : receptionOpens;
    const effectiveCloses = receptionCloses === undefined ? existing.recepcion_cierra_en : receptionCloses;
    if (effectiveOpens && effectiveCloses && effectiveOpens >= effectiveCloses) {
      return NextResponse.json({ error: "La hora de cierre debe ser posterior a la apertura de recepción." }, { status: 400 });
    }

    if (
      toDateInputValue(targetDeadline) > toDateInputValue(targetEventDate)
    ) {
      return NextResponse.json(
        {
          error:
            "La fecha límite de confirmación no puede ser posterior al día del evento.",
        },
        { status: 400 },
      );
    }
    const targetDeadlineKey = toDateInputValue(targetDeadline);
    const existingDeadlineKey = toDateInputValue(existing.fecha_limite_rsvp);
    if (targetDeadlineKey < toDateInputValue(new Date()) && targetDeadlineKey !== existingDeadlineKey) {
      return NextResponse.json(
        { error: "La fecha límite de confirmación debe ser hoy o una fecha futura." },
        { status: 400 },
      );
    }

    const requestedCapacity = capacidad_total === null || capacidad_total === "" || capacidad_total === undefined
      ? null
      : Number(capacidad_total);
    if (requestedCapacity !== null && (!Number.isInteger(requestedCapacity) || requestedCapacity < 1)) {
      return NextResponse.json({ error: "La capacidad del evento debe ser un número entero mayor a cero." }, { status: 400 });
    }
    if (user.rol !== "admin" && existing.limite_pases && requestedCapacity !== null && requestedCapacity > existing.limite_pases) {
      return NextResponse.json({ error: `Tu evento tiene un límite contratado de ${existing.limite_pases} pases.` }, { status: 403 });
    }

    const updated = await prisma.evento.update({
      where: { id },
      data: {
        ...(nombre && { nombre }),
        ...(anfitriones && { anfitriones }),
        ...(fecha_evento && { fecha_evento: new Date(fecha_evento) }),
        ...(lugar && { lugar }),
        ...(capacidad_total !== undefined && {
          capacidad_total:
            capacidad_total === null || capacidad_total === ""
              ? null
              : requestedCapacity,
        }),
        ...(fecha_limite_rsvp && { fecha_limite_rsvp: new Date(fecha_limite_rsvp) }),
        ...(texto_edad_nino !== undefined && { texto_edad_nino: String(texto_edad_nino).trim() }),
        ...(plantilla_mensaje && { plantilla_mensaje }),
        ...(plantilla_recordatorio && { plantilla_recordatorio }),
        ...(slug && { slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, "-") }),
        ...(nextState && { estado: nextState }),
        ...(recepcion_abre_en !== undefined && { recepcion_abre_en: receptionOpens }),
        ...(recepcion_cierra_en !== undefined && { recepcion_cierra_en: receptionCloses }),
        ...(nextEntryMode && { modo_ingreso: nextEntryMode }),
      },
    });

    return NextResponse.json({ ok: true, evento: updated });
  } catch (error) {
    console.error("Error al actualizar evento:", error);
    return NextResponse.json(
      { error: "Error al actualizar los datos del evento." },
      { status: 500 }
    );
  }
}
