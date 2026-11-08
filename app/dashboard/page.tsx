import { committedPasses, recoveredPasses, releasablePasses, contractedPassLimit } from "@/lib/pass-balance";
import LoadingLink from "@/components/LoadingLink";
import AttendanceRefresh from "@/components/AttendanceRefresh";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Calendar,
  MapPin,
  ArrowRight,
  AlertCircle,
  DoorOpen,
  ScanLine,
  UserCheck,
} from "lucide-react";
import { formatDateLongMx, formatDateMx, formatDateTimeMx } from "@/lib/utils";
import EventTypeIcon from "@/components/EventTypeIcon";
import { eventTypeThemes, getEventTypeFromConfig } from "@/lib/event-theme";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.rol === "admin" || user.rol === "organizador") redirect("/dashboard/usuarios");
  if (user.rol === "recepcionista") redirect("/dashboard/escanear");

  const evento = await prisma.evento.findFirst({
    where: { usuario_id: user.id },
    include: {
      invitados: {
        orderBy: { actualizado_en: "desc" },
      },
    },
    orderBy: { creado_en: "desc" },
  });

  if (!evento) {
    return (
      <div className="bg-white border border-[#ebd9c4] rounded-3xl p-8 text-center max-w-xl mx-auto my-12 shadow-sm">
        <Sparkles className="w-10 h-10 text-[#e05a1b] mx-auto mb-3" />
        <h2 className="text-xl font-serif font-bold text-stone-900 mb-2">
          No tienes eventos registrados
        </h2>
        <p className="text-xs text-stone-600 mb-6">
          Comunícate con la administradora de Monarque para asignar tu evento de
          invitaciones digitales.
        </p>
      </div>
    );
  }

  const eventType = getEventTypeFromConfig(evento.configuracion_invitacion);
  const eventTheme = eventTypeThemes[eventType];
  const isBautizo = eventType === "bautizo";
  const isBoda = eventType === "boda";
  const invitados = evento.invitados;

  // Cálculo de los 4 números clave:
  // Asignados, Confirmados, Declinados y Pendientes
  let total_asignados = 0;
  let total_confirmados = 0;
  let total_ninos = 0;
  let total_declinados = 0;
  let total_pendientes = 0;
  let total_parciales_count = 0;
  let total_liberados_parciales = 0;
  let total_ingresados = 0;
  let confirmados_pendientes_ingreso = 0;
  let familias_ingresadas = 0;

  for (const inv of invitados) {
    total_asignados += committedPasses(inv);
    // Los ingresos son históricos: una edición de la respuesta no los elimina.
    total_ingresados += inv.pases_ingresados;
    if (inv.pases_ingresados > 0) familias_ingresadas += 1;

    if (inv.estado === "confirmado") {
      const conf = inv.pases_confirmados || 0;
      total_confirmados += conf;
      confirmados_pendientes_ingreso += Math.max(0, conf - inv.pases_ingresados);
      total_ninos += inv.ninos_confirmados || 0;
      if (conf < inv.pases_asignados) {
        total_parciales_count += 1;
        total_liberados_parciales += inv.pases_asignados - conf;
      }
    } else if (inv.estado === "declinado") {
      total_declinados += inv.pases_asignados;
    } else {
      total_pendientes += inv.pases_asignados;
    }
  }

  const total_adultos = Math.max(0, total_confirmados - total_ninos);
  const total_pases_liberados = invitados.reduce((sum, guest) => sum + recoveredPasses(guest), 0);
  const porLiberar = invitados.reduce((sum, guest) => sum + releasablePasses(guest), 0);
  const qrCheckinEnabled = Boolean(user.organizacion?.qr_checkin_habilitado);

  const capacidad = evento.capacidad_total ?? contractedPassLimit({ ...evento, usuario: user }) ?? 0;
  // Cupos comprometidos reales: Confirmados + Pendientes (quienes declinaron ya liberaron su lugar)
  const cuposComprometidos = total_asignados;
  const cuposDisponibles = capacidad - cuposComprometidos;

  const pctConfirmados =
    capacidad > 0 ? Math.min(100, (total_confirmados / capacidad) * 100) : 0;
  const pctPendientes =
    capacidad > 0
      ? Math.min(
          Math.max(0, 100 - pctConfirmados),
          (total_pendientes / capacidad) * 100,
        )
      : 0;

  const now = new Date();
  const fechaLimite = new Date(evento.fecha_limite_rsvp);
  const diffTime = fechaLimite.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const rsvpVencido = diffTime <= 0;

  // Invitados con respuesta reciente para darle vida al panel
  const ultimasRespuestas = invitados
    .filter((i) => i.ultima_respuesta_en)
    .sort(
      (a, b) =>
        (b.ultima_respuesta_en?.getTime() || 0) -
        (a.ultima_respuesta_en?.getTime() || 0),
    )
    .slice(0, 6);

  return (
    <div className="space-y-8">
      {/* Tarjeta de Información del Evento */}
      <div
        className={`rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden transition-all ${
          isBautizo
            ? "dashboard-bautizo-header border border-[#82b4c6] dark:border-[#387892] dark:bg-[#133b4b] shadow-md"
            : isBoda
              ? "dashboard-boda-header border border-[#e8c2cc] dark:border-[#4a353d] shadow-md bg-cover bg-center bg-no-repeat"
              : "bg-white dark:bg-[#16171a] border border-[#ebd9c4] dark:border-[#26272b]"
        }`}
        style={
          isBautizo
            ? { backgroundColor: "#9DCDDD" }
            : isBoda
              ? { backgroundImage: "url('/boda-header.jpg?v=2')" }
              : undefined
        }
      >
        {isBoda ? (
          <div className="dark-preserve absolute inset-0 bg-white/30 dark:bg-black/55 pointer-events-none transition-colors duration-200" />
        ) : isBautizo ? (
          <>
            <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-white/40 via-white/10 to-transparent rounded-bl-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-white/25 via-transparent to-transparent rounded-tr-full pointer-events-none" />
          </>
        ) : (
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-[#ffedd5]/50 via-[#fbf8f4]/30 to-transparent rounded-bl-full pointer-events-none" />
        )}

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`text-[11px] uppercase tracking-widest font-semibold ${
                isBautizo
                  ? "text-[#144254] dark:text-sky-300"
                  : isBoda
                    ? "text-[#2b0d18] dark:text-white font-bold"
                    : "text-[#e05a1b]"
              }`}
            >
              Control de Pases e Invitaciones
            </span>
            <span
              className={`w-1 h-1 rounded-full ${
                isBautizo
                  ? "bg-[#2c667d] dark:bg-sky-300"
                  : isBoda
                    ? "bg-[#C84B73] dark:bg-pink-300"
                    : "bg-[#dec0a2]"
              }`}
            />
            <span
              className={`text-[11px] font-medium ${
                isBautizo
                  ? "text-[#1b4859] dark:text-sky-200/90"
                  : isBoda
                    ? "text-[#2b0d18] dark:text-white font-semibold"
                    : "text-stone-400"
              }`}
            >
              Monarque Elite
            </span>
          </div>

          <div className="flex items-center gap-3.5">
            {isBautizo || isBoda ? (
              <EventTypeIcon
                type={eventType}
                className="text-3xl sm:text-4xl shrink-0"
              />
            ) : (
              <div
                className="event-theme-chip flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-sm sm:h-14 sm:w-14"
                style={{
                  "--chip-bg": eventTheme.soft,
                  "--chip-border": eventTheme.softBorder,
                  "--chip-text": eventTheme.accentStrong,
                } as React.CSSProperties}
              >
                <EventTypeIcon
                  type={eventType}
                  className="h-6 w-6 sm:h-7 sm:w-7"
                  strokeWidth={1.7}
                />
              </div>
            )}
            <h1
              className={`font-serif text-3xl font-bold tracking-tight sm:text-4xl ${
                isBautizo
                  ? "text-[#0e2c39] dark:text-white"
                  : isBoda
                    ? "text-[#1f0911] dark:text-white"
                    : "text-[#2b211b]"
              }`}
            >
              {evento.nombre}
            </h1>
          </div>

          <p
            className={`text-sm mt-1 font-medium ${
              isBautizo
                ? "text-[#1b4859] dark:text-sky-100"
                : isBoda
                  ? "text-[#240a14] dark:text-white font-semibold"
                  : "text-stone-600"
            }`}
          >
            Anfitriones:{" "}
            <span
              className={`font-semibold ${
                isBautizo
                  ? "text-[#0d2733] dark:text-white"
                  : isBoda
                    ? "text-[#14040a] dark:text-white font-bold"
                    : "text-stone-800"
              }`}
            >
              {evento.anfitriones}
            </span>
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-4 text-xs">
            <div
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border ${
                isBautizo
                  ? "bg-white/85 dark:bg-[#0d2936]/90 backdrop-blur-sm border-white/60 dark:border-sky-400/30 text-[#144254] dark:text-sky-100 shadow-xs"
                  : isBoda
                    ? "bg-white/85 dark:bg-[#240d17]/90 backdrop-blur-sm border-white/70 dark:border-pink-400/35 text-[#5C1F36] dark:text-pink-100 shadow-xs"
                    : "bg-[#fbf8f4] border-[#ebd9c4] text-stone-600"
              }`}
            >
              <Calendar
                className={`w-3.5 h-3.5 ${
                  isBautizo
                    ? "text-[#1e586f] dark:text-sky-300"
                    : isBoda
                      ? "text-[#B83B64] dark:text-pink-300"
                      : "text-[#e05a1b]"
                }`}
              />
              <span>
                Fecha del evento:{" "}
                <strong
                  className={
                    isBautizo
                      ? "text-[#0d2733] dark:text-white"
                      : isBoda
                        ? "text-[#3D1222] dark:text-white"
                        : ""
                  }
                >
                  {formatDateLongMx(evento.fecha_evento)}
                </strong>
              </span>
            </div>
            <div
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border ${
                isBautizo
                  ? "bg-white/85 dark:bg-[#0d2936]/90 backdrop-blur-sm border-white/60 dark:border-sky-400/30 text-[#144254] dark:text-sky-100 shadow-xs"
                  : isBoda
                    ? "bg-white/85 dark:bg-[#240d17]/90 backdrop-blur-sm border-white/70 dark:border-pink-400/35 text-[#5C1F36] dark:text-pink-100 shadow-xs"
                    : "bg-[#fbf8f4] border-[#ebd9c4] text-stone-600"
              }`}
            >
              <MapPin
                className={`w-3.5 h-3.5 ${
                  isBautizo
                    ? "text-[#1e586f] dark:text-sky-300"
                    : isBoda
                      ? "text-[#B83B64] dark:text-pink-300"
                      : "text-[#e05a1b]"
                }`}
              />
              <span
                className={`max-w-sm ${
                  isBautizo
                    ? "text-[#0d2733] dark:text-white font-medium"
                    : isBoda
                      ? "text-[#3D1222] dark:text-white font-medium"
                      : ""
                }`}
              >
                {evento.lugar}
              </span>
            </div>
          </div>
        </div>

        {/* Alerta de Fecha Límite */}
        <div
          className={`relative z-10 mt-6 pt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs border-t ${
            isBautizo
              ? "border-[#82b4c6]/70 dark:border-sky-400/30"
              : isBoda
                ? "border-[#b88a96]/70 dark:border-white/40"
                : "border-[#f5ede2]"
          }`}
        >
          <div className="flex items-center gap-2 dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
            <AlertCircle
              className={`w-4 h-4 shrink-0 ${
                rsvpVencido
                  ? "text-rose-600 dark:text-rose-400"
                  : diffDays <= 5
                    ? isBautizo || isBoda
                      ? "text-amber-900 dark:text-amber-300"
                      : "text-[#e05a1b]"
                    : isBautizo
                      ? "text-[#0d2733] dark:text-white"
                      : isBoda
                        ? "text-[#1f0911] dark:text-white"
                        : "text-[#c59b4c]"
              }`}
            />
            <span
              className={
                isBautizo
                  ? "text-[#0d2733] dark:text-white font-semibold"
                  : isBoda
                    ? "text-[#1a070e] dark:text-white font-semibold"
                    : "text-stone-800 dark:text-white font-semibold"
              }
            >
              Fecha límite de confirmación:{" "}
              <strong
                className={
                  isBautizo
                    ? "text-[#071921] dark:text-white font-extrabold"
                    : isBoda
                      ? "text-[#120308] dark:text-white font-extrabold"
                      : "text-stone-950 dark:text-white font-extrabold"
                }
              >
                {formatDateMx(evento.fecha_limite_rsvp)}
              </strong>{" "}
              (hasta las 23:59 hrs)
            </span>
          </div>

          <div>
            {rsvpVencido ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/90 text-rose-900 dark:text-white dark:border dark:border-rose-400/60 shadow-xs">
                Plazo cerrado automáticamente
              </span>
            ) : (
              <span
                className={`dark-preserve inline-flex items-center px-3.5 py-1.5 rounded-full text-xs font-bold shadow-sm ${
                  isBautizo
                    ? "bg-white dark:bg-sky-400/25 text-[#0a222c] dark:text-white border border-[#7ab0c4] dark:border-sky-300/50"
                    : isBoda
                      ? "bg-white/95 dark:bg-white/20 dark:backdrop-blur-md text-[#1f0911] dark:text-white border border-[#c99aa7] dark:border-white/45"
                      : "bg-[#ffedd5] dark:bg-orange-500/25 text-[#7c2d12] dark:text-white"
                }`}
              >
                Plazo abierto: quedan {diffDays}{" "}
                {diffDays === 1 ? "día" : "días"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Barra de Capacidad del Evento (Dinámica y en tiempo real) */}
      {capacidad > 0 && (
        <div className="bg-[#eef2f6] dark:bg-[#16171a] border border-slate-200/90 dark:border-[#26272b] rounded-2xl p-5 sm:p-6 shadow-xs space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-600">
                  Capacidad del Evento
                </span>
                <span className="text-stone-300">•</span>
                <span className="text-xs font-bold text-[#2b211b]">
                  {capacidad} asientos totales
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                {total_confirmados} confirmados • {total_pendientes} en espera
                de responder · {Math.max(0, cuposComprometidos - total_confirmados)} lugares adicionales reservados · {cuposComprometidos} comprometidos en total
              </p>
            </div>

            <div>
              {cuposDisponibles >= 0 ? (
                <div className="text-sm text-stone-700 sm:text-right">
                  <p className="font-semibold">Quedan {cuposDisponibles} {cuposDisponibles === 1 ? "pase disponible" : "pases disponibles"}</p>
                  <p className="mt-1 text-xs text-stone-500">{total_confirmados} confirmados de {capacidad} asientos{cuposComprometidos > total_confirmados ? ` · ${cuposComprometidos - total_confirmados} reservados sin confirmar` : ""}.</p>
                </div>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                  Los lugares comprometidos exceden la capacidad por {Math.abs(cuposDisponibles)}{" "}
                  {Math.abs(cuposDisponibles) === 1 ? "asiento" : "asientos"}
                </span>
              )}
            </div>
          </div>

          {/* Barra de progreso visual segmentada dinámica */}
          <div className="dark-preserve w-full bg-white dark:bg-[#0c0d10] border border-slate-300/80 dark:border-[#2b2d31] h-3.5 rounded-full overflow-hidden p-0.5 flex">
            {/* Segmento verde: Confirmados reales (sube al confirmar) */}
            {pctConfirmados > 0 && (
              <div
                title={`${total_confirmados} confirmados (${Math.round(pctConfirmados)}%)`}
                className="bg-emerald-600 h-full rounded-l-full transition-all duration-500"
                style={{ width: `${pctConfirmados}%` }}
              />
            )}
            {/* Segmento naranja: Pendientes en espera */}
            {pctPendientes > 0 && (
              <div
                title={`${total_pendientes} pendientes (${Math.round(pctPendientes)}%)`}
                className={`bg-[#e05a1b] h-full transition-all duration-500 ${
                  pctConfirmados === 0 ? "rounded-l-full" : ""
                } ${pctConfirmados + pctPendientes >= 100 ? "rounded-r-full" : ""}`}
                style={{ width: `${pctPendientes}%` }}
              />
            )}
          </div>

          {/* Leyenda visual rápida de los colores de la barra */}
          <div className="flex flex-wrap items-center gap-4 text-[11px] text-stone-600 dark:text-[#dbdee1] pt-2 border-t border-slate-200/90 dark:border-[#26272b]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
              <span>
                <strong>{total_confirmados}</strong> confirmados (
                {capacidad > 0 ? Math.round(total_confirmados / capacidad * 100) : 0}%)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#e05a1b] inline-block" />
              <span>
                <strong>{total_pendientes}</strong> en espera (
                {Math.round(pctPendientes)}%)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#dec0a2] inline-block" />
              <span>
                <strong>{Math.max(0, cuposDisponibles)}</strong> libres para
                invitar
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 4 Métricas Clave Clicables (Toca para ver quiénes son) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xs uppercase tracking-wider font-bold text-stone-500">
              Estado de Pases y Asistencia
            </h2>
            <p className="text-[11px] text-stone-400 mt-0.5">
              Haz clic en cualquier tarjeta para ver la lista filtrada de
              invitados
            </p>
          </div>
          <span className="text-xs text-stone-500 font-medium">
            {invitados.length} familias e invitados
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Asignados (Azul cielo sólido, sin marcos) */}
          <LoadingLink
            href="/dashboard/invitados"
            title="Ver todos los invitados asignados"
            className="dark-preserve bg-[#cbe7fd] dark:bg-[#173b5c] rounded-2xl p-5 shadow-sm hover:shadow-xl hover:shadow-sky-500/15 dark:hover:shadow-sky-950/60 hover:-translate-y-1.5 hover:scale-[1.02] active:scale-[0.99] transition-all duration-300 ease-out cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-[#0c4a6e] dark:text-[#bae6fd] mb-2">
                <span className="text-xs font-bold uppercase tracking-wider group-hover:text-[#082f49] dark:group-hover:text-white transition-colors">
                  Asignados
                </span>
                <Users className="w-4 h-4 text-[#0284c7] dark:text-[#38bdf8] group-hover:scale-125 group-hover:-rotate-6 transition-transform duration-300 ease-out" />
              </div>
              <p className="text-3xl sm:text-4xl font-serif font-bold text-[#082f49] dark:text-white group-hover:translate-x-0.5 transition-transform duration-300">
                {total_asignados}
              </p>
              <p className="text-xs text-[#0c4a6e] dark:text-[#e0f2fe] mt-1 font-semibold">
                Pases totales repartidos
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-[#a3d2f7] dark:border-[#214d75] flex items-center justify-between text-[11px] font-bold text-[#075985] dark:text-[#bae6fd]">
              <span>Ver todos</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1.5 transition-transform duration-300" />
            </div>
          </LoadingLink>

          {/* 2. Confirmados (Verde esmeralda sólido, sin marcos) */}
          <LoadingLink
            href="/dashboard/invitados?estado=confirmado"
            title="Ver invitados que ya confirmaron asistencia"
            className="dark-preserve bg-[#bbf7d0] dark:bg-[#134635] rounded-2xl p-5 shadow-sm hover:shadow-xl hover:shadow-emerald-500/15 dark:hover:shadow-emerald-950/60 hover:-translate-y-1.5 hover:scale-[1.02] active:scale-[0.99] transition-all duration-300 ease-out cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-[#064e3b] dark:text-[#a7f3d0] mb-2">
                <span className="text-xs font-bold uppercase tracking-wider group-hover:text-[#022c22] dark:group-hover:text-white transition-colors">
                  Confirmados
                </span>
                <CheckCircle2 className="w-4 h-4 text-[#059669] dark:text-[#34d399] group-hover:scale-125 group-hover:rotate-6 transition-transform duration-300 ease-out" />
              </div>
              <p className="text-3xl sm:text-4xl font-serif font-bold text-[#022c22] dark:text-white group-hover:translate-x-0.5 transition-transform duration-300">
                {total_confirmados}
              </p>

              {/* Etiquetas sólidas de alto contraste para adultos y niños (sin marcos resaltados) */}
              <div className="flex flex-wrap items-center gap-1.5 mt-3">
                <span className="dark-preserve inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-white dark:bg-[#047857] text-[#022c22] dark:text-white font-semibold shadow-xs group-hover:scale-[1.03] transition-transform duration-300">
                  <span>👤</span>
                  <span>
                    <strong className="font-extrabold text-sm text-[#022c22] dark:text-white">
                      {total_adultos}
                    </strong>{" "}
                    {total_adultos === 1 ? "adulto" : "adultos"}
                  </span>
                </span>
                <span className="dark-preserve inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-[#fde047] dark:bg-[#b45309] text-[#451a03] dark:text-white font-semibold shadow-xs group-hover:scale-[1.03] transition-transform duration-300 delay-75">
                  <span>🧒</span>
                  <span>
                    <strong className="font-extrabold text-sm text-[#451a03] dark:text-white">
                      {total_ninos}
                    </strong>{" "}
                    {total_ninos === 1 ? "niño" : "niños"}
                  </span>
                </span>
              </div>

              {/* Barra visual sólida de proporción */}
              {total_confirmados > 0 && (
                <div className="w-full bg-[#86efac] dark:bg-[#09261c] h-2 rounded-full overflow-hidden flex mt-3">
                  <div
                    title={`${total_adultos} adultos`}
                    className="bg-[#059669] dark:bg-[#10b981] h-full transition-all"
                    style={{
                      width: `${(total_adultos / total_confirmados) * 100}%`,
                    }}
                  />
                  <div
                    title={`${total_ninos} niños`}
                    className="bg-[#d97706] dark:bg-[#f59e0b] h-full transition-all"
                    style={{
                      width: `${(total_ninos / total_confirmados) * 100}%`,
                    }}
                  />
                </div>
              )}
            </div>
            <div className="mt-3 pt-2.5 border-t border-[#7ce8a3] dark:border-[#1c5943] flex items-center justify-between text-[11px] font-bold text-[#065f46] dark:text-[#a7f3d0]">
              <span>Ver quiénes van</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1.5 transition-transform duration-300" />
            </div>
          </LoadingLink>

          {/* 3. Pases Liberados / Declinados (Rosa coral sólido, sin marcos) */}
          <LoadingLink
            href="/dashboard/invitados?estado=liberados"
            title="Ver invitados que liberaron pases (declinados o confirmación parcial)"
            className="dark-preserve bg-[#fecdd3] dark:bg-[#54192a] rounded-2xl p-5 shadow-sm hover:shadow-xl hover:shadow-rose-500/15 dark:hover:shadow-rose-950/60 hover:-translate-y-1.5 hover:scale-[1.02] active:scale-[0.99] transition-all duration-300 ease-out cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-[#881337] dark:text-[#fecdd3] mb-2">
                <span className="text-xs font-bold uppercase tracking-wider group-hover:text-[#4c0519] dark:group-hover:text-white transition-colors">
                  Pases Liberados
                </span>
                <XCircle className="w-4 h-4 text-[#e11d48] dark:text-[#fb7185] group-hover:scale-125 group-hover:rotate-12 transition-transform duration-300 ease-out" />
              </div>
              <p className="text-3xl sm:text-4xl font-serif font-bold text-[#4c0519] dark:text-white group-hover:translate-x-0.5 transition-transform duration-300">
                {total_pases_liberados}
              </p>
              <p className="text-xs text-[#881337] dark:text-[#ffe4e6] mt-1 font-semibold leading-relaxed">
                {`${porLiberar} disponibles para liberar de quienes declinaron`}
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-[#fdaab7] dark:border-[#732138] flex items-center justify-between text-[11px] font-bold text-[#9f1239] dark:text-[#fecdd3]">
              <span>Ver quiénes liberaron</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1.5 transition-transform duration-300" />
            </div>
          </LoadingLink>

          {/* 4. Pendientes (Ámbar cálido sólido, sin marcos) */}
          <LoadingLink
            href="/dashboard/invitados?estado=pendiente"
            title="Ver invitados que aún no confirman ni declinan"
            className="dark-preserve bg-[#fde68a] dark:bg-[#52340d] rounded-2xl p-5 shadow-sm hover:shadow-xl hover:shadow-amber-500/15 dark:hover:shadow-amber-950/60 hover:-translate-y-1.5 hover:scale-[1.02] active:scale-[0.99] transition-all duration-300 ease-out cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-[#78350f] dark:text-[#fde68a] mb-2">
                <span className="text-xs font-bold uppercase tracking-wider group-hover:text-[#451a03] dark:group-hover:text-white transition-colors">
                  Pendientes
                </span>
                <Clock className="w-4 h-4 text-[#d97706] dark:text-[#fbbf24] group-hover:scale-125 group-hover:rotate-12 transition-transform duration-300 ease-out" />
              </div>
              <p className="text-3xl sm:text-4xl font-serif font-bold text-[#451a03] dark:text-white group-hover:translate-x-0.5 transition-transform duration-300">
                {total_pendientes}
              </p>
              <p className="text-xs text-[#78350f] dark:text-[#fef3c7] mt-1 font-semibold">
                Aún sin respuesta
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-[#fbd355] dark:border-[#6e4612] flex items-center justify-between text-[11px] font-bold text-[#92400e] dark:text-[#fde68a]">
              <span>Ver quiénes faltan</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1.5 transition-transform duration-300" />
            </div>
          </LoadingLink>
        </div>
      </div>

      {qrCheckinEnabled && (
        <section className="rounded-3xl border border-[#cce3d6] dark:border-[#26272b] bg-[#f4faf6] dark:bg-[#16171a] p-5 shadow-xs sm:p-6">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#047857] dark:text-[#34d399]">Control de acceso QR</p>
              <h2 className="mt-1 font-serif text-2xl font-bold text-[#183126] dark:text-white">Asistencia en el evento</h2>
              <p className="mt-1 text-xs text-stone-600 dark:text-[#dbdee1]">Pulsa Actualizar asistencia para consultar las últimas entradas.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <AttendanceRefresh />
              <LoadingLink href="/dashboard/invitados?entrada=ingresaron" className="inline-flex items-center gap-1 text-xs font-bold text-[#047857] dark:text-[#34d399] hover:text-[#064e3b] dark:hover:text-[#6ee7b7]">Ver entradas <ArrowRight className="h-3.5 w-3.5" /></LoadingLink>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <LoadingLink href="/dashboard/invitados?entrada=ingresaron" className="dark-preserve group rounded-2xl bg-[#d1fae5] dark:bg-[#134635] p-4 shadow-xs transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.015] hover:shadow-lg">
              <div className="flex items-center justify-between text-[#065f46] dark:text-[#a7f3d0]"><span className="text-[11px] font-bold uppercase tracking-wider">Ya ingresaron</span><DoorOpen className="h-4 w-4 transition-transform duration-300 group-hover:scale-125 group-hover:-rotate-6" /></div>
              <p className="mt-2 font-serif text-3xl font-bold text-[#022c22] dark:text-white">{total_ingresados}</p>
              <p className="mt-1 text-xs font-semibold text-[#065f46] dark:text-[#d1fae5]">personas registradas</p>
            </LoadingLink>
            <LoadingLink href="/dashboard/invitados?entrada=sin_ingreso" className="dark-preserve group rounded-2xl bg-[#fef3c7] dark:bg-[#52340d] p-4 shadow-xs transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.015] hover:shadow-lg">
              <div className="flex items-center justify-between text-[#78350f] dark:text-[#fde68a]"><span className="text-[11px] font-bold uppercase tracking-wider">Pendientes de llegar</span><ScanLine className="h-4 w-4 transition-transform duration-300 group-hover:scale-125" /></div>
              <p className="mt-2 font-serif text-3xl font-bold text-[#451a03] dark:text-white">{confirmados_pendientes_ingreso}</p>
              <p className="mt-1 text-xs font-semibold text-[#78350f] dark:text-[#fef3c7]">pases confirmados pendientes</p>
            </LoadingLink>
            <LoadingLink href="/dashboard/invitados?entrada=ingresaron" className="dark-preserve group rounded-2xl bg-[#cbe7fd] dark:bg-[#173b5c] p-4 shadow-xs transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.015] hover:shadow-lg">
              <div className="flex items-center justify-between text-[#0c4a6e] dark:text-[#bae6fd]"><span className="text-[11px] font-bold uppercase tracking-wider">Familias recibidas</span><UserCheck className="h-4 w-4 transition-transform duration-300 group-hover:scale-125 group-hover:rotate-6" /></div>
              <p className="mt-2 font-serif text-3xl font-bold text-[#082f49] dark:text-white">{familias_ingresadas}</p>
              <p className="mt-1 text-xs font-semibold text-[#0c4a6e] dark:text-[#e0f2fe]">registros con al menos una entrada</p>
            </LoadingLink>
          </div>
        </section>
      )}

      {/* Actividad Reciente */}
      <div className="bg-[#f4f6f9] dark:bg-[#16171a] border border-slate-200/90 dark:border-[#26272b] rounded-3xl p-6 sm:p-8 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-[#f5ede2] mb-4">
          <div>
            <h3 className="font-serif font-bold text-xl text-[#2b211b]">
              Últimas Respuestas Recibidas
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Confirmaciones registradas en tiempo real por tus invitados
            </p>
          </div>
          <LoadingLink
            href="/dashboard/invitados"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#e05a1b] hover:text-[#b8420f] transition-colors"
          >
            <span>Ver toda la lista</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </LoadingLink>
        </div>

        {ultimasRespuestas.length === 0 ? (
          <div className="text-center py-12 text-stone-400 text-xs">
            Aún no hay respuestas registradas. Comparte los links por WhatsApp
            para comenzar a recibir confirmaciones.
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {ultimasRespuestas.map((inv) => (
              <div
                key={inv.id}
                className="py-3.5 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#fbf8f4] border border-[#dec0a2] flex items-center justify-center font-serif font-bold text-[#2b211b] text-sm shrink-0">
                    {inv.nombre.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-stone-900">
                      {inv.nombre}
                    </p>
                    <p className="text-xs text-stone-500">
                      {inv.grupo || "General"}
                      {inv.estado === "confirmado" &&
                      (inv.ninos_confirmados || 0) > 0 ? (
                        <>
                          {" "}
                          •{" "}
                          <span className="font-semibold text-amber-700">
                            {inv.ninos_confirmados}{" "}
                            {inv.ninos_confirmados === 1 ? "niño" : "niños"}
                          </span>
                        </>
                      ) : null}{" "}
                      • Respondido: {formatDateTimeMx(inv.ultima_respuesta_en)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-semibold text-stone-800">
                    {inv.pases_confirmados ?? 0} de {inv.pases_asignados}{" "}
                    {inv.pases_asignados === 1 ? "pase" : "pases"}
                  </span>
                  {inv.estado === "confirmado" ? (
                    (inv.pases_confirmados || 0) < inv.pases_asignados ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-[#3b250b] text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-500/50">
                        Parcial
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-[#0c3627] text-emerald-800 dark:text-emerald-200 border border-transparent dark:border-emerald-500/50">
                        Confirmó
                      </span>
                    )
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 dark:bg-[#3d1320] text-rose-800 dark:text-rose-200 border border-transparent dark:border-rose-500/50">
                      Declinó
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
