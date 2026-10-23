import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isEventFinished, toDateInputValue } from "@/lib/utils";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  // RF-02: Cada clienta solo puede ver los datos de su propio evento.
  const whereClause = user.rol === "admin" ? {} : { usuario_id: user.id };

  const eventos = await prisma.evento.findMany({
    where: whereClause,
    include: {
      _count: {
        select: { invitados: true },
      },
    },
    orderBy: { creado_en: "desc" },
  });

  return NextResponse.json({ eventos });
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
    } = data;

    if (!id) {
      return NextResponse.json({ error: "ID del evento requerido." }, { status: 400 });
    }

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
              : parseInt(String(capacidad_total), 10) || null,
        }),
        ...(fecha_limite_rsvp && { fecha_limite_rsvp: new Date(fecha_limite_rsvp) }),
        ...(texto_edad_nino !== undefined && { texto_edad_nino: String(texto_edad_nino).trim() }),
        ...(plantilla_mensaje && { plantilla_mensaje }),
        ...(plantilla_recordatorio && { plantilla_recordatorio }),
        ...(slug && { slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, "-") }),
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
