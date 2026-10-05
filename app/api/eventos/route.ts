import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

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
      fecha_limite_rsvp,
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

    const updated = await prisma.evento.update({
      where: { id },
      data: {
        ...(nombre && { nombre }),
        ...(anfitriones && { anfitriones }),
        ...(fecha_evento && { fecha_evento: new Date(fecha_evento) }),
        ...(lugar && { lugar }),
        ...(fecha_limite_rsvp && { fecha_limite_rsvp: new Date(fecha_limite_rsvp) }),
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
