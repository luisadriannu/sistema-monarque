import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { isOrganizationServiceActive } from "@/lib/organization-access";

const headers = { "Cache-Control": "no-store" };

class EntradaYaRegistrada extends Error {
  constructor(public invitado: unknown) { super("ALREADY_SCANNED"); }
}

class EventoIncorrecto extends Error {
  constructor() { super("WRONG_EVENT"); }
}

async function authorizedScanner() {
  const user = await getCurrentUser();
  if (user?.rol === "admin") return user;
  if (!user || !["organizador", "recepcionista"].includes(user.rol) || !user.organizacion_id || !user.organizacion?.qr_checkin_habilitado || !isOrganizationServiceActive(user.organizacion)) return null;
  if (user.rol === "recepcionista" && !user.lector_qr_habilitado) return null;
  return user;
}

function eventScope(user: { id: string; rol: string; organizacion_id: string | null }) {
  const enabledClient = { OR: [
    { usuario: { organizacion_id: "monarque-clientes-directos", lector_qr_habilitado: true } },
    { usuario: { organizacion_id: { not: "monarque-clientes-directos" }, organizacion: { qr_checkin_habilitado: true } } },
  ] };
  if (user.rol === "admin") return enabledClient;
  return user.rol === "recepcionista"
    ? { ...enabledClient, usuario: { organizacion_id: user.organizacion_id! }, recepcionistas: { some: { usuario_id: user.id } } }
    : { ...enabledClient, usuario: { organizacion_id: user.organizacion_id! } };
}

const guestSelect = {
  id: true, nombre: true, grupo: true, codigo_entrada: true, pases_asignados: true, pases_confirmados: true,
  pases_ingresados: true, ultima_entrada_en: true, estado: true, evento: { select: { id: true, nombre: true, anfitriones: true, modo_ingreso: true, usuario: { select: { organizacion_id: true } } } },
  escaneado_en: true,
} as const;

export async function GET(request: Request) {
  const user = await authorizedScanner();
  if (!user) return NextResponse.json({ error: "El acceso QR no está habilitado." }, { status: 403, headers });
  const searchParams = new URL(request.url).searchParams;

  if (searchParams.get("catalogo") === "1") {
    const eventos = await prisma.evento.findMany({
      where: eventScope(user),
      select: {
        id: true,
        nombre: true,
        anfitriones: true,
        fecha_evento: true,
        lugar: true,
        estado: true,
        recepcion_abre_en: true,
        recepcion_cierra_en: true,
        modo_ingreso: true,
      },
      orderBy: [{ fecha_evento: "desc" }, { creado_en: "desc" }],
    });
    return NextResponse.json({ eventos }, { headers });
  }

  const eventoId = searchParams.get("evento_id")?.trim();
  if (!eventoId) {
    return NextResponse.json(
      { error: "Selecciona el evento antes de escanear.", code: "EVENT_REQUIRED" },
      { status: 400, headers },
    );
  }

  const eventoActivo = await prisma.evento.findFirst({
    where: { id: eventoId, ...eventScope(user) },
    select: { id: true, nombre: true, estado: true, modo_ingreso: true, recepcion_abre_en: true, recepcion_cierra_en: true },
  });
  if (!eventoActivo) {
    return NextResponse.json(
      { error: "El evento seleccionado no pertenece a tu organización." },
      { status: 403, headers },
    );
  }

  const code = searchParams.get("codigo")?.replace(/^monarque:entrada:/, "").trim();
  const search = searchParams.get("buscar")?.trim();
  if (search) {
    const resultados = await prisma.invitado.findMany({
      where: { evento_id: eventoActivo.id, nombre: { contains: search, mode: "insensitive" }, estado: "confirmado" },
      select: guestSelect,
      orderBy: { nombre: "asc" },
      take: 12,
    });
    return NextResponse.json({ resultados, evento: eventoActivo }, { headers });
  }
  if (code) {
    if (eventoActivo.estado !== "recepcion_abierta") return NextResponse.json({ error: "La recepción de este evento está cerrada.", code: "RECEPTION_CLOSED" }, { status: 409, headers });
    const invitado = await prisma.invitado.findUnique({ where: { codigo_entrada: code }, select: guestSelect });
    if (!invitado || (user.rol !== "admin" && invitado.evento.usuario.organizacion_id !== user.organizacion_id)) return NextResponse.json({ error: "Código no válido para tu organización." }, { status: 404, headers });
    if (invitado.evento.id !== eventoActivo.id) {
      return NextResponse.json(
        {
          error: `Este pase no pertenece a ${eventoActivo.nombre}. No se registró ninguna entrada.`,
          code: "WRONG_EVENT",
        },
        { status: 409, headers },
      );
    }
    if (!invitado.pases_ingresados && !invitado.ultima_entrada_en && (invitado.estado !== "confirmado" || (invitado.pases_confirmados ?? 0) < 1)) return NextResponse.json({ error: "El invitado debe confirmar su asistencia antes de utilizar el pase QR.", code: "NOT_CONFIRMED" }, { status: 409, headers });
    return NextResponse.json({ invitado }, { headers });
  }
  const requestedPage = Math.max(1, Math.floor(Number(searchParams.get("page")) || 1));
  const attendanceWhere = { pases_ingresados: { gt: 0 }, evento_id: eventoActivo.id };
  const total = await prisma.invitado.count({ where: attendanceWhere });
  const totalPages = Math.max(1, Math.ceil(total / 25));
  const page = Math.min(requestedPage, totalPages);
  const asistentes = await prisma.invitado.findMany({
    where: attendanceWhere,
    select: { ...guestSelect, ultima_entrada_en: true },
    orderBy: [{ ultima_entrada_en: "desc" }, { id: "asc" }],
    skip: (page - 1) * 25, take: 25,
  });
  const registros = await prisma.registroEntrada.findMany({
    where: { evento_id: eventoActivo.id },
    include: { invitado: { select: { nombre: true, grupo: true } }, evento: { select: { nombre: true } } },
    orderBy: { creado_en: "desc" }, take: 100,
  });
  return NextResponse.json({ registros, asistentes, pagination: { page, total, total_pages: totalPages } }, { headers });
}

export async function POST(request: Request) {
  const user = await authorizedScanner();
  if (!user) return NextResponse.json({ error: "El acceso QR no está habilitado." }, { status: 403, headers });
  const body = await request.json().catch(() => null);
  if (!body || (!(typeof body.codigo === "string" && body.codigo.trim()) && !(typeof body.invitado_id === "string" && body.invitado_id.trim()))) return NextResponse.json({ error: "Indica un código o invitado válido." }, { status: 400, headers });
  const code = String(body.codigo || "").replace(/^monarque:entrada:/, "").trim();
  const guestId = String(body.invitado_id || "").trim();
  const eventoId = String(body.evento_id || "").trim();
  const cantidad = Number(body.cantidad);
  if (!eventoId) return NextResponse.json({ error: "Selecciona el evento antes de confirmar la entrada.", code: "EVENT_REQUIRED" }, { status: 400, headers });
  if (!Number.isInteger(cantidad) || cantidad < 1) return NextResponse.json({ error: "Indica una cantidad válida." }, { status: 400, headers });

  const eventoActivo = await prisma.evento.findFirst({
    where: { id: eventoId, ...eventScope(user) },
    select: { id: true, nombre: true, estado: true, modo_ingreso: true },
  });
  if (!eventoActivo) return NextResponse.json({ error: "El evento seleccionado no pertenece a tu organización." }, { status: 403, headers });
  if (eventoActivo.estado !== "recepcion_abierta") return NextResponse.json({ error: "La recepción de este evento está cerrada.", code: "RECEPTION_CLOSED" }, { status: 409, headers });

  try {
    const result = await prisma.$transaction(async tx => {
      const invitado = guestId
        ? await tx.invitado.findUnique({ where: { id: guestId }, select: guestSelect })
        : await tx.invitado.findUnique({ where: { codigo_entrada: code }, select: guestSelect });
      if (!invitado || (user.rol !== "admin" && invitado.evento.usuario.organizacion_id !== user.organizacion_id)) throw new Error("INVALID_CODE");
      if (invitado.evento.id !== eventoActivo.id) throw new EventoIncorrecto();
      const limite = invitado.pases_confirmados ?? 0;
      if (invitado.estado === "declinado") throw new Error("DECLINED");
      if (invitado.estado !== "confirmado" || limite < 1) throw new Error("NOT_CONFIRMED");
      const fullyUsed = invitado.pases_ingresados >= limite;
      if (fullyUsed || (eventoActivo.modo_ingreso === "unico" && invitado.escaneado_en)) throw new EntradaYaRegistrada(invitado);
      if (invitado.pases_ingresados + cantidad > limite) throw new Error("CAPACITY");
      const scannedAt = new Date();
      const updated = await tx.invitado.update({ where: { id: invitado.id }, data: { pases_ingresados: { increment: cantidad }, ultima_entrada_en: scannedAt, escaneado_en: scannedAt, escaneado_por: user.id }, select: { pases_ingresados: true, ultima_entrada_en: true, escaneado_en: true } });
      await tx.registroEntrada.create({ data: { invitado_id: invitado.id, evento_id: invitado.evento.id, escaneado_por_id: user.id, cantidad } });
      return { ...invitado, ...updated, registro_adicional: invitado.pases_ingresados > 0 };
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({
      ok: true,
      invitado: result,
      registro_adicional: result.registro_adicional,
      message: result.registro_adicional
        ? `Pases adicionales registrados: ${cantidad}. Total de ingresos: ${result.pases_ingresados}.`
        : `Entrada registrada: ${cantidad} ${cantidad === 1 ? "persona" : "personas"}.`,
    }, { headers });
  } catch (error) {
    if (error instanceof EntradaYaRegistrada) {
      return NextResponse.json({ error: "Este código QR ya ha sido escaneado. La entrada ya está registrada.", code: "ALREADY_SCANNED", invitado: error.invitado }, { status: 409, headers });
    }
    if (error instanceof EventoIncorrecto) {
      return NextResponse.json(
        { error: `Este pase no pertenece a ${eventoActivo.nombre}. No se registró ninguna entrada.`, code: "WRONG_EVENT" },
        { status: 409, headers },
      );
    }
    const message = error instanceof Error ? error.message : "";
    if (typeof error === "object" && error && "code" in error && error.code === "P2034") {
      return NextResponse.json({ error: "El pase se está registrando en otro dispositivo. Escanéalo nuevamente." }, { status: 409, headers });
    }
    if (message === "NOT_CONFIRMED") return NextResponse.json({ error: "El invitado debe confirmar su asistencia antes de utilizar el pase QR.", code: "NOT_CONFIRMED" }, { status: 409, headers });
    const response = message === "CAPACITY" ? ["Ese QR ya alcanzó el total de accesos permitidos.", 409] : message === "DECLINED" ? ["Este invitado declinó la invitación.", 409] : message === "INVALID_CODE" ? ["El código no es válido para tu organización.", 404] : ["No se pudo registrar la entrada. Intenta nuevamente.", 500];
    return NextResponse.json({ error: response[0] }, { status: Number(response[1]), headers });
  }
}
