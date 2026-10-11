import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { generateInvitationToken } from "@/lib/tokens";

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
    include: { evento: true },
  });

  if (!invitado) {
    return NextResponse.json({ error: "Invitado no encontrado." }, { status: 404 });
  }

  if (user.rol !== "admin" && invitado.evento.usuario_id !== user.id) {
    return NextResponse.json(
      { error: "No tienes permiso para modificar este invitado." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();

    // Acción especial: Regenerar link (RF-13)
    if (body.action === "regenerar_link") {
      const nuevoToken = generateInvitationToken();
      const actualizado = await prisma.invitado.update({
        where: { id },
        data: { token: nuevoToken },
      });
      return NextResponse.json({
        ok: true,
        message: "Link regenerado exitosamente. El link anterior quedó invalidado.",
        token: nuevoToken,
        invitado: actualizado,
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
      updateData.nombre = String(nombre).trim();
    }

    if (grupo !== undefined) {
      updateData.grupo = grupo ? String(grupo).trim() : null;
    }

    if (pases_asignados !== undefined) {
      const nuevoAsignados = parseInt(String(pases_asignados), 10);
      if (isNaN(nuevoAsignados) || nuevoAsignados < 1) {
        return NextResponse.json(
          { error: "Los pases asignados deben ser mínimo 1." },
          { status: 400 }
        );
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

    const actualizado = await prisma.invitado.update({
      where: { id },
      data: updateData,
    });

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
    include: { evento: true },
  });

  if (!invitado) {
    return NextResponse.json({ error: "Invitado no encontrado." }, { status: 404 });
  }

  if (user.rol !== "admin" && invitado.evento.usuario_id !== user.id) {
    return NextResponse.json(
      { error: "No tienes permiso para eliminar este invitado." },
      { status: 403 }
    );
  }

  try {
    await prisma.invitado.delete({
      where: { id },
    });

    return NextResponse.json({
      ok: true,
      message: "Invitado eliminado exitosamente.",
    });
  } catch (error) {
    console.error("Error al borrar invitado:", error);
    return NextResponse.json(
      { error: "Error al eliminar el invitado." },
      { status: 500 }
    );
  }
}
