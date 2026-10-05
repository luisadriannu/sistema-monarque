import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkRateLimit } from "@/lib/ratelimit";

export async function GET(request: Request) {
  // RNF-03: Límite de intentos por IP
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(ip, 60, 60)) {
    return NextResponse.json(
      { error: "Demasiadas peticiones. Por favor intenta más tarde." },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  const token = searchParams.get("token") || searchParams.get("id");

  if (!slug || !token) {
    return NextResponse.json(
      { error: "Invitación no disponible." },
      { status: 404 }
    );
  }

  try {
    const invitado = await prisma.invitado.findFirst({
      where: {
        token: token.trim(),
        evento: {
          slug: slug.trim(),
        },
      },
      include: {
        evento: {
          select: {
            nombre: true,
            anfitriones: true,
            fecha_evento: true,
            lugar: true,
            fecha_limite_rsvp: true,
          },
        },
      },
    });

    // RF-23: Si el token no existe o fue invalidado, mostrar mensaje genérico
    if (!invitado) {
      return NextResponse.json(
        { error: "Invitación no disponible." },
        { status: 404 }
      );
    }

    // RF-21: Al abrir la invitación con un token válido por primera vez, el estado cambia a Visto
    if (invitado.estado === "pendiente") {
      await prisma.invitado.update({
        where: { id: invitado.id },
        data: { estado: "visto" },
      });
      invitado.estado = "visto";
    }

    const now = new Date();
    const fechaLimite = new Date(invitado.evento.fecha_limite_rsvp);
    const expirado = now > fechaLimite;

    // RF-24: Mostrar solo nombre y pases del invitado. Nunca teléfonos ni otros datos.
    return NextResponse.json({
      invitado: {
        nombre: invitado.nombre,
        pases_asignados: invitado.pases_asignados,
        pases_confirmados: invitado.pases_confirmados,
        estado: invitado.estado,
        ultima_respuesta_en: invitado.ultima_respuesta_en,
      },
      evento: {
        nombre: invitado.evento.nombre,
        anfitriones: invitado.evento.anfitriones,
        fecha_evento: invitado.evento.fecha_evento,
        lugar: invitado.evento.lugar,
        fecha_limite_rsvp: invitado.evento.fecha_limite_rsvp,
        expirado,
      },
    });
  } catch (error) {
    console.error("Error al obtener invitación:", error);
    return NextResponse.json(
      { error: "Invitación no disponible." },
      { status: 404 }
    );
  }
}

export async function POST(request: Request) {
  // RNF-03: Límite de intentos por IP
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  if (!checkRateLimit(ip, 30, 60)) {
    return NextResponse.json(
      { error: "Demasiadas peticiones. Por favor intenta más tarde." },
      { status: 429 }
    );
  }

  try {
    const { token, pases_confirmados } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: "Token de invitación inválido." },
        { status: 400 }
      );
    }

    const invitado = await prisma.invitado.findUnique({
      where: { token: token.trim() },
      include: { evento: true },
    });

    if (!invitado) {
      return NextResponse.json(
        { error: "Invitación no disponible." },
        { status: 404 }
      );
    }

    // RN-03: Pasada la fecha límite, el servidor rechaza nuevas respuestas
    const now = new Date();
    const fechaLimite = new Date(invitado.evento.fecha_limite_rsvp);
    if (now > fechaLimite) {
      return NextResponse.json(
        {
          error:
            "La fecha límite para confirmar o modificar tu asistencia ha vencido. Por favor comunícate directamente con los anfitriones.",
        },
        { status: 400 }
      );
    }

    // RN-01: Validación estricta en el servidor
    const pases = parseInt(String(pases_confirmados), 10);
    if (isNaN(pases) || pases < 0) {
      return NextResponse.json(
        { error: "El número de pases debe ser igual o mayor a 0." },
        { status: 400 }
      );
    }

    if (pases > invitado.pases_asignados) {
      return NextResponse.json(
        {
          error: `No puedes confirmar más de ${invitado.pases_asignados} ${
            invitado.pases_asignados === 1 ? "pase asignado" : "pases asignados"
          }.`,
        },
        { status: 400 }
      );
    }

    // RF-20: Si elige 0 -> declinado; si > 0 -> confirmado
    const nuevoEstado = pases === 0 ? "declinado" : "confirmado";

    const actualizado = await prisma.invitado.update({
      where: { id: invitado.id },
      data: {
        pases_confirmados: pases,
        estado: nuevoEstado,
        ultima_respuesta_en: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      mensaje:
        pases === 0
          ? "Hemos registrado que no podrás acompañarnos. ¡Gracias por avisarnos!"
          : `¡Confirmación registrada con éxito para ${pases} ${
              pases === 1 ? "persona" : "personas"
            }!`,
      invitado: {
        nombre: actualizado.nombre,
        pases_asignados: actualizado.pases_asignados,
        pases_confirmados: actualizado.pases_confirmados,
        estado: actualizado.estado,
        ultima_respuesta_en: actualizado.ultima_respuesta_en,
      },
    });
  } catch (error) {
    console.error("Error al procesar RSVP:", error);
    return NextResponse.json(
      { error: "Ocurrió un error al registrar tu respuesta." },
      { status: 500 }
    );
  }
}
