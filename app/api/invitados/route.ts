import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { generateInvitationToken } from "@/lib/tokens";
import { isEventFinished } from "@/lib/utils";
import type { Prisma } from "@/generated/prisma-client-v2";

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
      include: { usuario: { select: { organizacion_id: true } } },
    });
  } else {
    evento = await prisma.evento.findFirst({
      where: user.rol === "admin" ? {} : { usuario_id: user.id },
      orderBy: { creado_en: "desc" },
      include: { usuario: { select: { organizacion_id: true } } },
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
      pases_confirmados: true,
      estado: true,
    },
  });

  // Cálculo de KPIs (RF-25, RN-05)
  let total_asignados = 0;
  let total_confirmados = 0;
  let total_declinados_pases = 0;
  let total_pendientes_pases = 0;
  let pases_liberados = 0;

  for (const inv of todosInvitados) {
    total_asignados += inv.pases_asignados;

    if (inv.estado === "confirmado") {
      const conf = inv.pases_confirmados || 0;
      total_confirmados += conf;
      // Pases liberados: si le dieron 4 pero confirmó 2, se liberaron 2
      pases_liberados += Math.max(0, inv.pases_asignados - conf);
    } else if (inv.estado === "declinado") {
      total_declinados_pases += inv.pases_asignados;
      // Todos los asignados quedan liberados al declinar
      pases_liberados += inv.pases_asignados;
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
      solo_lectura: user.rol === "admin" || isEventFinished(evento.fecha_evento),
      vista_admin: user.rol === "admin",
      kpis: {
        total_asignados,
        total_confirmados,
        total_declinados: total_declinados_pases,
        total_pendientes: total_pendientes_pases,
        pases_liberados,
        total_invitados: todosInvitados.length,
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
      include: { usuario: { select: { organizacion_id: true } } },
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


    if (user.rol !== "admin" && isEventFinished(evento.fecha_evento)) {
      return NextResponse.json(
        {
          error:
            "El evento ya finalizó. La lista de invitados se encuentra en modo de solo lectura.",
        },
        { status: 403 },
      );
    }

    // Manejo de importación masiva (RF-10)
    if (bulk && Array.isArray(invitados)) {
      const creados = [];
      for (const item of invitados) {
        const nombreLimpio = String(item.nombre || "").trim();
        const pasesNum = parseInt(item.pases_asignados ?? item.pases ?? "1", 10);

        if (!nombreLimpio || isNaN(pasesNum) || pasesNum < 1) {
          continue; // Omitir filas inválidas
        }

        const nuevoInvitado = await prisma.invitado.create({
          data: {
            evento_id: evento.id,
            nombre: nombreLimpio,
            grupo: item.grupo ? String(item.grupo).trim() : null,
            pases_asignados: pasesNum,
            token: generateInvitationToken(),
            estado: "pendiente",
          },
        });
        creados.push(nuevoInvitado);
      }

      return NextResponse.json({
        ok: true,
        importados: creados.length,
        totalRecibidos: invitados.length,
      });
    }

    // Creación individual (RF-08)
    const nombreLimpio = String(nombre || "").trim();
    const pasesNum = Number(pases_asignados);

    if (!nombreLimpio) {
      return NextResponse.json(
        { error: "El nombre del invitado o familia es obligatorio." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(pasesNum) || pasesNum < 1) {
      return NextResponse.json(
        { error: "Los pases asignados deben ser un número entero mayor o igual a 1." },
        { status: 400 }
      );
    }

    const token = generateInvitationToken(); // RF-12, RNF-01

    const nuevoInvitado = await prisma.invitado.create({
      data: {
        evento_id: evento.id,
        nombre: nombreLimpio,
        grupo: grupo ? String(grupo).trim() : null,
        pases_asignados: pasesNum,
        token,
        estado: "pendiente",
      },
    });

    return NextResponse.json({ ok: true, invitado: nuevoInvitado });
  } catch (error) {
    console.error("Error al registrar invitado:", error);
    return NextResponse.json(
      { error: "Error al guardar el invitado." },
      { status: 500 }
    );
  }
}
