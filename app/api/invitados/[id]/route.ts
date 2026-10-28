import { committedPasses, contractedPassLimit } from "@/lib/pass-balance";
import { hasAttendance, noAttendance, attendanceLockMessage } from "@/lib/attendance-lock";
import { isValidName, NAME_ERROR } from "@/lib/names";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { generateInvitationToken } from "@/lib/tokens";
import { isEventFinished } from "@/lib/utils";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { id } = await params;
  const invitado = await prisma.invitado.findUnique({
    where: { id },
    include: { evento: { include: { usuario: { select: { organizacion_id: true, organizacion: true } } } } },
  });

  if (!invitado) {
    return NextResponse.json({ error: "Invitado no encontrado." }, { status: 404 });
  }

  const organizerOwnsEvent = user.rol === "organizador" && user.organizacion_id === invitado.evento.usuario.organizacion_id;
  if (user.rol !== "admin" && invitado.evento.usuario_id !== user.id && !organizerOwnsEvent) {
    return NextResponse.json(
      { error: "No tienes permiso para modificar este invitado." },
      { status: 403 }
    );
  }

  if (user.rol !== "admin" && isEventFinished(invitado.evento.fecha_evento)) {
    return NextResponse.json(
      {
        error:
          "El evento ya finalizó. Los invitados se encuentran disponibles únicamente para consulta.",
      },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    if (body.action === "liberar_pases") {
      const changed = await prisma.invitado.updateMany({ where: { id, estado: "declinado", ...noAttendance }, data: { pases_liberados: true } });
      if (changed.count !== 1) return NextResponse.json({ error: "Solo puedes liberar pases de un invitado que declinó y aún no tiene ingresos ni pases liberados." }, { status: 409 });
      return NextResponse.json({ ok: true, message: "Pases devueltos al saldo del evento. La confirmación de este invitado quedó cerrada." });
    }

    const deadlineClosed = Date.now() > new Date(invitado.evento.fecha_limite_rsvp).getTime();
    const wantsPassChange = body.pases_asignados !== undefined && Number(body.pases_asignados) !== invitado.pases_asignados;
    if (deadlineClosed && (wantsPassChange || body.action === "regenerar_link")) return NextResponse.json({ error: "El plazo de confirmación ha cerrado. Solo puedes corregir el nombre y el grupo; los pases y la confirmación están cerrados.", code: "RSVP_CLOSED" }, { status: 409 });

    if (hasAttendance(invitado) && (body.action === "regenerar_link" || (body.pases_asignados !== undefined && Number(body.pases_asignados) !== invitado.pases_asignados))) return NextResponse.json({ error: attendanceLockMessage, code: "ATTENDANCE_LOCKED" }, { status: 409 });

    // Acción especial: Regenerar link (RF-13)
    if (body.action === "regenerar_link") {
      const nuevoToken = generateInvitationToken();
      const nuevoCodigoEntrada = generateInvitationToken(32);
      const changed = await prisma.invitado.updateMany({
        where: { id, ...noAttendance, evento: { fecha_limite_rsvp: { gte: new Date() } } },
        data: {
          token: nuevoToken,
          estado: "pendiente",
          pases_confirmados: null,
          ninos_confirmados: 0,
          ultima_respuesta_en: null,
          enviado_en: null,
          // El enlace nuevo también invalida cualquier captura del QR anterior.
          // Los ingresos históricos se conservan aunque se solicite una respuesta nueva.
          codigo_entrada: nuevoCodigoEntrada,
          escaneado_en: null,
          escaneado_por: null,
        },
      });
      if (changed.count !== 1) return NextResponse.json({ error: attendanceLockMessage, code: "ATTENDANCE_LOCKED" }, { status: 409 });
      return NextResponse.json({
        ok: true,
        message: "Enlace regenerado. Comparte el nuevo enlace para que el invitado confirme su asistencia.",
        token: nuevoToken,
        invitado: await prisma.invitado.findUnique({ where: { id } }),
      });
    }

    // Acción especial: Marcar como enviado al copiar o enviar WhatsApp
    if (body.action === "marcar_enviado") {
      const actualizado = await prisma.invitado.update({
        where: { id },
        data: { enviado_en: new Date() },
      });
      return NextResponse.json({
        ok: true,
        enviado_en: actualizado.enviado_en,
        invitado: actualizado,
      });
    }

    // Edición normal
    const { nombre, grupo, pases_asignados } = body;
    const updateData: Record<string, unknown> = {};

    if (nombre !== undefined) {
      if (!isValidName(nombre)) return NextResponse.json({ error: NAME_ERROR }, { status: 400 });
      updateData.nombre = String(nombre).trim();
    }

    if (grupo !== undefined) {
      updateData.grupo = grupo ? String(grupo).trim() : null;
    }

    if (pases_asignados !== undefined) {
      const nuevoAsignados = Number(pases_asignados);
      if (!Number.isInteger(nuevoAsignados) || nuevoAsignados < 1) {
        return NextResponse.json(
          { error: "Los pases asignados deben ser mínimo 1." },
          { status: 400 }
        );
      }

      const limit = contractedPassLimit(invitado.evento);
      if (user.rol !== "admin" && limit !== null && nuevoAsignados > invitado.pases_asignados) {
        const assigned = await prisma.invitado.findMany({ where: { evento_id: invitado.evento_id } });
        const nextTotal = assigned.reduce((sum, guest) => sum + committedPasses(guest), 0) - committedPasses(invitado) + nuevoAsignados;
        if (nextTotal > limit) {
          return NextResponse.json({ error: `No puedes aumentar esos pases. El límite contratado es ${limit}.` }, { status: 403 });
        }
      }

      updateData.pases_asignados = nuevoAsignados;

      let avisoAjuste: string | null = null;

      // RN-02 & RN-06: Si la clienta reduce los pases asignados por debajo de lo ya confirmado,
      // ajustar la confirmación y niños confirmados al nuevo máximo y avisarle.
      if (
        invitado.pases_confirmados !== null &&
        invitado.pases_confirmados > nuevoAsignados
      ) {
        updateData.pases_confirmados = nuevoAsignados;
        avisoAjuste = `Se ajustaron los pases confirmados al nuevo límite de ${nuevoAsignados}.`;
      }

      const pasesConfirmadosEfectivos =
        (updateData.pases_confirmados !== undefined
          ? (updateData.pases_confirmados as number)
          : invitado.pases_confirmados) ?? 0;

      if (invitado.ninos_confirmados > pasesConfirmadosEfectivos) {
        updateData.ninos_confirmados = pasesConfirmadosEfectivos;
        avisoAjuste = `Se ajustaron los pases y niños confirmados al nuevo límite de ${nuevoAsignados}.`;
      }
    }

    const changesPasses = updateData.pases_asignados !== undefined && Number(updateData.pases_asignados) !== invitado.pases_asignados;
    if (!changesPasses) {
      delete updateData.pases_asignados;
      delete updateData.pases_confirmados;
      delete updateData.ninos_confirmados;
    }
    const changed = await prisma.invitado.updateMany({ where: { id, ...(changesPasses ? { ...noAttendance, evento: { fecha_limite_rsvp: { gte: new Date() } } } : {}) }, data: updateData });
    if (changed.count !== 1) return NextResponse.json({ error: attendanceLockMessage, code: "ATTENDANCE_LOCKED" }, { status: 409 });
    const actualizado = await prisma.invitado.findUnique({ where: { id } });

    return NextResponse.json({
      ok: true,
      invitado: actualizado,
      aviso: (updateData.pases_asignados !== undefined && (updateData.pases_confirmados !== undefined || updateData.ninos_confirmados !== undefined))
          ? "Se redujeron los pases asignados; se ajustaron automáticamente los asistentes y niños confirmados."
          : undefined,
    });
  } catch (error) {
    console.error("Error al modificar invitado:", error);
    return NextResponse.json(
      { error: "Error al actualizar los datos del invitado." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const { id } = await params;
  const invitado = await prisma.invitado.findUnique({
    where: { id },
    include: { evento: { include: { usuario: { select: { organizacion_id: true } } } } },
  });

  if (!invitado) {
    return NextResponse.json({ error: "Invitado no encontrado." }, { status: 404 });
  }

  const organizerOwnsEvent = user.rol === "organizador" && user.organizacion_id === invitado.evento.usuario.organizacion_id;
  if (user.rol !== "admin" && invitado.evento.usuario_id !== user.id && !organizerOwnsEvent) {
    return NextResponse.json(
      { error: "No tienes permiso para eliminar este invitado." },
      { status: 403 }
    );
  }

  if (user.rol !== "admin" && isEventFinished(invitado.evento.fecha_evento)) {
    return NextResponse.json(
      {
        error:
          "El evento ya finalizó. Los invitados se encuentran disponibles únicamente para consulta.",
      },
      { status: 403 },
    );
  }

  try {
    const deleted = await prisma.invitado.deleteMany({
      where: { id, pases_ingresados: 0, ultima_entrada_en: null, escaneado_en: null, registros_entrada: { none: {} } },
    });
    if (deleted.count !== 1) return NextResponse.json({ error: "No puedes eliminar un invitado con ingresos registrados. Su historial de asistencia debe conservarse.", code: "ATTENDANCE_LOCKED" }, { status: 409 });

    return NextResponse.json({
      ok: true,
      message: "Invitado eliminado. Su enlace quedó invalidado y los pases aún reservados volvieron al saldo disponible.",
    });
  } catch (error) {
    console.error("Error al borrar invitado:", error);
    return NextResponse.json(
      { error: "Error al eliminar el invitado." },
      { status: 500 }
    );
  }
}
