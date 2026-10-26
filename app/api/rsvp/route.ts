import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkRateLimit } from "@/lib/ratelimit";
import { isEventFinished } from "@/lib/utils";
import { generateInvitationToken } from "@/lib/tokens";

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
            texto_edad_nino: true,
            estado: true,
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

    const now = new Date();
    const fechaLimite = new Date(invitado.evento.fecha_limite_rsvp);
    const expirado =
      now > fechaLimite || isEventFinished(invitado.evento.fecha_evento, now) || ["borrador", "cancelado", "archivado", "finalizado"].includes(invitado.evento.estado);

    // RF-24: Mostrar solo nombre y pases del invitado. Nunca teléfonos ni otros datos.
    return NextResponse.json({
      invitado: {
        nombre: invitado.nombre,
        pases_asignados: invitado.pases_asignados,
        pases_confirmados: invitado.pases_confirmados,
        ninos_confirmados: invitado.ninos_confirmados,
        estado: invitado.estado,
        ultima_respuesta_en: invitado.ultima_respuesta_en,
      },
      evento: {
        nombre: invitado.evento.nombre,
        anfitriones: invitado.evento.anfitriones,
        fecha_evento: invitado.evento.fecha_evento,
        lugar: invitado.evento.lugar,
        fecha_limite_rsvp: invitado.evento.fecha_limite_rsvp,
        texto_edad_nino: invitado.evento.texto_edad_nino || "menores de 12 años",
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
    const body = await request.json();
    const { token, pases_confirmados, ninos_confirmados } = body;

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

    if (["borrador", "cancelado", "archivado", "finalizado"].includes(invitado.evento.estado)) {
      return NextResponse.json({ error: "El evento no está disponible para recibir confirmaciones." }, { status: 409 });
    }

    // RN-03: Pasada la fecha límite, el servidor rechaza nuevas respuestas
    const now = new Date();
    const fechaLimite = new Date(invitado.evento.fecha_limite_rsvp);
    if (now > fechaLimite || isEventFinished(invitado.evento.fecha_evento, now)) {
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

    // RN-06: Validación de desglose de niños
    let ninos = 0;
    if (pases > 0 && invitado.pases_asignados >= 2) {
      const parsedNinos = parseInt(String(ninos_confirmados ?? 0), 10);
      if (isNaN(parsedNinos) || parsedNinos < 0 || parsedNinos > pases) {
        return NextResponse.json(
          {
            error: `El número de niños debe ser un valor válido entre 0 y los asistentes confirmados (${pases}).`,
          },
          { status: 400 }
        );
      }
      ninos = parsedNinos;
    } else {
      // Con 1 pase asignado o si declina (pases === 0), niños confirmados siempre es 0
      ninos = 0;
    }

    // RF-20: Si elige 0 -> declinado; si > 0 -> confirmado
    const nuevoEstado = pases === 0 ? "declinado" : "confirmado";
    const habilitaPasesAdicionales =
      pases > (invitado.pases_confirmados ?? 0) &&
      pases > invitado.pases_ingresados &&
      invitado.pases_ingresados > 0 &&
      Boolean(invitado.escaneado_en);

    const actualizado = await prisma.invitado.update({
      where: { id: invitado.id },
      data: {
        pases_confirmados: pases,
        ninos_confirmados: ninos,
        estado: nuevoEstado,
        ultima_respuesta_en: new Date(),
        ...(habilitaPasesAdicionales
          ? {
              codigo_entrada: generateInvitationToken(32),
              escaneado_en: null,
              escaneado_por: null,
            }
          : {}),
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
        ninos_confirmados: actualizado.ninos_confirmados,
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

// Marcar "visto" únicamente cuando JavaScript se ejecuta en un navegador real
// (evita que los bots de previsualización de WhatsApp marquen como visto)
export async function PATCH(request: Request) {
  try {
    const { token } = await request.json();
    if (!token) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const invitado = await prisma.invitado.findUnique({
      where: { token: String(token).trim() },
      include: {
        evento: {
          select: { fecha_evento: true },
        },
      },
    });

    if (
      invitado &&
      invitado.estado === "pendiente" &&
      !isEventFinished(invitado.evento.fecha_evento)
    ) {
      await prisma.invitado.update({
        where: { id: invitado.id },
        data: { estado: "visto" },
      });
      return NextResponse.json({ ok: true, estado: "visto" });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
