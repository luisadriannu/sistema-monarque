import { committedPasses, recoveredPasses, releasablePasses, contractedPassLimit } from "@/lib/pass-balance";
import { isValidName, NAME_ERROR } from "@/lib/names";
import { DIRECT_ORGANIZATION_ID } from "@/lib/management-access";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { generateInvitationToken } from "@/lib/tokens";
import { isEventFinished } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma-client-v3";
import { isOrganizationServiceActive, organizationBlockMessage } from "@/lib/organization-access";

export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
};

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "No autorizado." },
      { status: 401, headers: noStoreHeaders }
    );
  }

  const { searchParams } = new URL(request.url);
  const eventoIdParam = searchParams.get("evento_id");
  const search = searchParams.get("search")?.trim();
  const estado = searchParams.get("estado");
  const entrada = searchParams.get("entrada");
  const all = searchParams.get("all") === "true";
  const requestedPage = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(
    100,
    Math.max(10, Number(searchParams.get("page_size")) || 25),
  );

  // Buscar evento del usuario
  let evento;
  if (eventoIdParam) {
    evento = await prisma.evento.findUnique({
      where: { id: eventoIdParam },
      include: { usuario: { select: { organizacion_id: true, organizacion: true, lector_qr_habilitado: true } } },
    });
  } else {
    evento = await prisma.evento.findFirst({
      where: user.rol === "admin" ? {} : { usuario_id: user.id },
      orderBy: { creado_en: "desc" },
      include: { usuario: { select: { organizacion_id: true, organizacion: true, lector_qr_habilitado: true } } },
    });
  }

  if (!evento) {
    return NextResponse.json(
      {
        evento: null,
        invitados: [],
        pagination: { page: 1, page_size: pageSize, total: 0, total_pages: 1 },
        kpis: {
          total_asignados: 0,
          total_confirmados: 0,
          total_declinados: 0,
          total_pendientes: 0,
          pases_liberados: 0,
          total_invitados: 0,
          total_ingresados: 0,
          confirmados_pendientes_ingreso: 0,
          familias_ingresadas: 0,
        },
        permisos: {
          qr_checkin_habilitado: Boolean(user.organizacion?.qr_checkin_habilitado),
          limite_invitados: user.rol === "admin" || user.organizacion_id === DIRECT_ORGANIZATION_ID ? null : user.organizacion?.max_invitados_evento ?? null,
          limite_pases: null,
        },
      },
      { headers: noStoreHeaders }
    );
  }

  // Verificar pertenencia (RF-02)
  const organizerOwnsEvent = user.rol === "organizador" && user.organizacion_id && evento.usuario.organizacion_id === user.organizacion_id;
  if (user.rol !== "admin" && evento.usuario_id !== user.id && !organizerOwnsEvent) {
    return NextResponse.json(
      { error: "No tienes permiso para ver los invitados de este evento." },
      { status: 403, headers: noStoreHeaders }
    );
  }

  // Solo se leen los campos numéricos necesarios para mantener KPIs globales
  // exactos sin enviar todos los registros al navegador.
  const todosInvitados = await prisma.invitado.findMany({
    where: { evento_id: evento.id },
    select: {
      pases_asignados: true,
      pases_liberados: true,
      pases_confirmados: true,
      pases_ingresados: true,
      ultima_entrada_en: true,
      estado: true,
    },
  });

  // Cálculo de KPIs (RF-25, RN-05)
  let total_asignados = 0;
  let total_confirmados = 0;
  let total_declinados_pases = 0;
  let total_pendientes_pases = 0;
  let pases_liberados = 0;
  let disponibles_para_liberar = 0;
  let total_ingresados = 0;
  let confirmados_pendientes_ingreso = 0;
  let familias_ingresadas = 0;

  for (const inv of todosInvitados) {
    total_asignados += committedPasses(inv);
    pases_liberados += recoveredPasses(inv);
    disponibles_para_liberar += releasablePasses(inv);
    total_ingresados += inv.pases_ingresados;
    if (inv.pases_ingresados > 0) familias_ingresadas += 1;

    if (inv.estado === "confirmado") {
      const conf = inv.pases_confirmados || 0;
      total_confirmados += conf;
      confirmados_pendientes_ingreso += Math.max(0, conf - inv.pases_ingresados);
      // Pases liberados: si le dieron 4 pero confirmó 2, se liberaron 2

    } else if (inv.estado === "declinado") {
      total_declinados_pases += inv.pases_asignados;
      // Todos los asignados quedan liberados al declinar

    } else {
      // pendiente o visto
      total_pendientes_pases += inv.pases_asignados;
    }
  }

  const where: Prisma.InvitadoWhereInput = { evento_id: evento.id };

  if (search) {
    where.OR = [
      { nombre: { contains: search, mode: "insensitive" } },
      { grupo: { contains: search, mode: "insensitive" } },
    ];
  }

  if (estado && estado !== "todos") {
    if (estado === "pendiente") {
      where.estado = { in: ["pendiente", "visto"] };
    } else if (estado === "parcial") {
      where.AND = [
        { estado: "confirmado" },
        { pases_confirmados: { gt: 0 } },
        {
          pases_confirmados: {
            lt: prisma.invitado.fields.pases_asignados,
          },
        },
      ];
    } else if (estado === "liberados") {
      where.AND = [
        {
          OR: [
            { estado: "declinado" },
            {
              estado: "confirmado",
              pases_confirmados: {
                lt: prisma.invitado.fields.pases_asignados,
              },
            },
          ],
        },
      ];
    } else {
      where.estado = estado;
    }
  }

  if (entrada && entrada !== "todos") {
    const entryCondition: Prisma.InvitadoWhereInput = entrada === "ingresaron"
      ? { pases_ingresados: { gt: 0 } }
      : entrada === "sin_ingreso"
        ? { estado: "confirmado", pases_confirmados: { gt: 0 }, pases_ingresados: 0 }
        : entrada === "parcial"
          ? {
              estado: "confirmado",
              pases_ingresados: { gt: 0 },
              pases_confirmados: { gt: 0 },
              AND: [{ pases_ingresados: { lt: prisma.invitado.fields.pases_confirmados } }],
            }
          : entrada === "completo"
            ? {
                estado: "confirmado",
                pases_confirmados: { gt: 0 },
                pases_ingresados: { gte: prisma.invitado.fields.pases_confirmados },
              }
            : {};
    where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), entryCondition];
  }

  const total = await prisma.invitado.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const invitadosFiltrados = await prisma.invitado.findMany({
    where,
    orderBy: { creado_en: "desc" },
    ...(all ? {} : { skip: (page - 1) * pageSize, take: pageSize }),
  });

  return NextResponse.json(
    {
      evento,
      invitados: invitadosFiltrados,
      pagination: {
        page,
        page_size: pageSize,
        total,
        total_pages: totalPages,
      },
      solo_lectura: user.rol !== "admin" && isEventFinished(evento.fecha_evento),
      vista_admin: user.rol === "admin",
      permisos: {
        qr_checkin_habilitado: hasClientQr(evento.usuario),
        limite_invitados: user.rol === "admin" || evento.usuario.organizacion_id === DIRECT_ORGANIZATION_ID ? null : evento.usuario.organizacion?.max_invitados_evento ?? null,
        limite_pases: user.rol === "admin" ? null : contractedPassLimit(evento),
        limite_pases_contratados: (() => {
          const limits = [evento.limite_pases, evento.usuario.organizacion_id === DIRECT_ORGANIZATION_ID ? null : evento.usuario.organizacion?.max_invitados_evento]
            .filter((value): value is number => typeof value === "number" && value > 0);
          return limits.length ? Math.min(...limits) : null;
        })(),
      },
      kpis: {
        total_asignados,
        total_confirmados,
        total_declinados: total_declinados_pases,
        total_pendientes: total_pendientes_pases,
        pases_liberados,
        disponibles_para_liberar,
        total_invitados: todosInvitados.length,
        total_ingresados,
        confirmados_pendientes_ingreso,
        familias_ingresadas,
      },
    },
    { headers: noStoreHeaders }
  );
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { evento_id, bulk, invitados, nombre, grupo, pases_asignados } = body;

    if (!evento_id) {
      return NextResponse.json({ error: "ID del evento requerido." }, { status: 400 });
    }

    const evento = await prisma.evento.findUnique({
      where: { id: evento_id },
      include: { usuario: { select: { organizacion_id: true, organizacion: true } } },
    });

    if (!evento) {
      return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
    }

    // RF-02: Verificación de propiedad
    const organizerOwnsEvent = user.rol === "organizador" && user.organizacion_id && evento.usuario.organizacion_id === user.organizacion_id;
    if (user.rol !== "admin" && evento.usuario_id !== user.id && !organizerOwnsEvent) {
      return NextResponse.json(
        { error: "No tienes permiso para agregar invitados en este evento." },
        { status: 403 }
      );
    }

    if (user.rol !== "admin" && evento.usuario.organizacion && !isOrganizationServiceActive(evento.usuario.organizacion)) {
      return NextResponse.json({ error: organizationBlockMessage(evento.usuario.organizacion) }, { status: 403 });
    }


    if (user.rol !== "admin" && isEventFinished(evento.fecha_evento)) {
      return NextResponse.json(
        {
          error:
            "El evento ya finalizó. La lista de invitados se encuentra en modo de solo lectura.",
        },
        { status: 403 },
      );
    }

    const rows = bulk && Array.isArray(invitados) ? invitados : [{ nombre, grupo, pases_asignados }];
    if (!rows.length) return NextResponse.json({ error: "Agrega al menos un invitado." }, { status: 400 });
    const normalized = rows.map(item => ({
      nombre: String(item.nombre || "").trim(),
      grupo: item.grupo ? String(item.grupo).trim() : null,
      pases_asignados: Number(item.pases_asignados ?? item.pases ?? 1),
    }));
    if (normalized.some(item => !isValidName(item.nombre))) return NextResponse.json({ error: NAME_ERROR }, { status: 400 });
    if (normalized.some(item => !Number.isSafeInteger(item.pases_asignados) || item.pases_asignados < 1)) return NextResponse.json({ error: "Los pases deben ser números enteros mayores a cero." }, { status: 400 });

    // Both writes share a serializable transaction: no guest without its updated capacity.
    const save = () => prisma.$transaction(async tx => {
      const current = await tx.evento.findUniqueOrThrow({ where: { id: evento.id }, include: { usuario: { include: { organizacion: true } } } });
      const guests = await tx.invitado.findMany({ where: { evento_id: evento.id } });
      const committed = guests.reduce((sum, guest) => sum + committedPasses(guest), 0);
      const nextTotal = committed + normalized.reduce((sum, item) => sum + item.pases_asignados, 0);
      const limit = contractedPassLimit(current);
      if (limit !== null && nextTotal > limit) throw new Error("PASS_LIMIT");
      const guestLimit = current.usuario.organizacion?.max_invitados_evento;
      if (user.rol !== "admin" && guestLimit && guests.length + normalized.length > guestLimit) throw new Error("GUEST_LIMIT");
      const capacity = current.capacidad_total === null ? null : Math.max(current.capacidad_total, nextTotal);
      if (capacity !== current.capacidad_total && limit !== null && capacity !== null && capacity > limit) throw new Error("PASS_LIMIT");
      const created = [];
      for (const item of normalized) created.push(await tx.invitado.create({ data: { ...item, evento_id: evento.id, token: generateInvitationToken(), estado: "pendiente" } }));
      if (capacity !== current.capacidad_total) await tx.evento.update({ where: { id: evento.id }, data: { capacidad_total: capacity } });
      return { created, capacity, adjusted: capacity !== current.capacidad_total };
    }, { isolationLevel: "Serializable" });
    let result: Awaited<ReturnType<typeof save>> | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      try { result = await save(); break; } catch (error) {
        if (typeof error === "object" && error && "code" in error && error.code === "P2034" && attempt < 2) continue;
        throw error;
      }
    }
    if (!result) throw new Error("SAVE_FAILED");
    const extra = { capacidad_total: result.capacity, capacidad_actualizada: result.adjusted };
    return NextResponse.json(bulk ? { ok: true, importados: result.created.length, totalRecibidos: rows.length, ...extra } : { ok: true, invitado: result.created[0], ...extra });
  } catch (error) {
    if (error instanceof Error && error.message === "PASS_LIMIT") return NextResponse.json({ error: "Los pases superan el límite contratado. Reduce los pases o contacta a tu administrador." }, { status: 403 });
    if (error instanceof Error && error.message === "GUEST_LIMIT") return NextResponse.json({ error: "Alcanzaste el límite de invitaciones contratado." }, { status: 403 });
    if (typeof error === "object" && error && "code" in error && error.code === "P2034") return NextResponse.json({ error: "Se está actualizando este evento. Intenta guardar nuevamente." }, { status: 409 });
    console.error("Error al registrar invitado:", error);
    return NextResponse.json(
      { error: "Error al guardar el invitado." },
      { status: 500 }
    );
  }
}
import { hasClientQr } from "@/lib/qr-access";
