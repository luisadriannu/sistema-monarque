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
            : "bg-white dark:bg-[#111c38] border border-[#ebd9c4] dark:border-[#20315c]"
        }`}
        style={isBautizo ? { backgroundColor: "#9DCDDD" } : undefined}
      >
        {isBautizo ? (
          <>
            <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-white/35 via-white/10 to-transparent rounded-bl-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-white/20 via-transparent to-transparent rounded-tr-full pointer-events-none" />
          </>
        ) : (
          <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-[#ffedd5]/50 via-[#fbf8f4]/30 to-transparent rounded-bl-full pointer-events-none" />
        )}

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`text-[11px] uppercase tracking-widest font-semibold ${
                isBautizo ? "text-[#144254] dark:text-sky-300" : "text-[#e05a1b]"
              }`}
            >
              Control de Pases e Invitaciones
            </span>
            <span
              className={`w-1 h-1 rounded-full ${
                isBautizo ? "bg-[#2c667d] dark:bg-sky-300" : "bg-[#dec0a2]"
              }`}
            />
            <span
              className={`text-[11px] font-medium ${
                isBautizo ? "text-[#1b4859] dark:text-sky-200/90" : "text-stone-400"
              }`}
            >
              Monarque Elite
            </span>
          </div>

          <div className="flex items-center gap-3.5">
            {isBautizo ? (
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
                isBautizo ? "text-[#0e2c39] dark:text-white" : "text-[#2b211b]"
              }`}
            >
              {evento.nombre}
            </h1>
          </div>

          <p
            className={`text-sm mt-1 font-medium ${
              isBautizo ? "text-[#1b4859] dark:text-sky-100" : "text-stone-600"
            }`}
          >
            Anfitriones:{" "}
            <span
              className={`font-semibold ${
                isBautizo ? "text-[#0d2733] dark:text-white" : "text-stone-800"
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
                  : "bg-[#fbf8f4] border-[#ebd9c4] text-stone-600"
              }`}
            >
              <Calendar
                className={`w-3.5 h-3.5 ${
                  isBautizo ? "text-[#1e586f] dark:text-sky-300" : "text-[#e05a1b]"
                }`}
              />
              <span>
                Fecha del evento:{" "}
                <strong className={isBautizo ? "text-[#0d2733] dark:text-white" : ""}>
                  {formatDateLongMx(evento.fecha_evento)}
                </strong>
              </span>
            </div>
            <div
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border ${
                isBautizo
                  ? "bg-white/85 dark:bg-[#0d2936]/90 backdrop-blur-sm border-white/60 dark:border-sky-400/30 text-[#144254] dark:text-sky-100 shadow-xs"
                  : "bg-[#fbf8f4] border-[#ebd9c4] text-stone-600"
              }`}
            >
              <MapPin
                className={`w-3.5 h-3.5 ${
                  isBautizo ? "text-[#1e586f] dark:text-sky-300" : "text-[#e05a1b]"
                }`}
              />
              <span
                className={`max-w-sm ${
                  isBautizo ? "text-[#0d2733] dark:text-white font-medium" : ""
                }`}
              >
                {evento.lugar}
              </span>
            </div>
          </div>
        </div>

        {/* Alerta de Fecha Límite */}
        <div
          className={`mt-6 pt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs border-t ${
            isBautizo ? "border-[#82b4c6]/70 dark:border-sky-400/30" : "border-[#f5ede2]"
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertCircle
              className={`w-4 h-4 shrink-0 ${
                rsvpVencido
                  ? "text-rose-600 dark:text-rose-400"
                  : diffDays <= 5
                    ? isBautizo ? "text-amber-800 dark:text-amber-300" : "text-[#e05a1b]"
                    : isBautizo ? "text-[#144254] dark:text-sky-300" : "text-[#c59b4c]"
              }`}
            />
            <span className={isBautizo ? "text-[#144254] dark:text-sky-100 font-medium" : "text-stone-700"}>
              Fecha límite de confirmación:{" "}
              <strong className={isBautizo ? "text-[#0d2733] dark:text-white" : ""}>
                {formatDateMx(evento.fecha_limite_rsvp)}
              </strong>{" "}
              (hasta las 23:59 hrs)
            </span>
          </div>

          <div>
            {rsvpVencido ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 dark:border dark:border-rose-700/60 shadow-xs">
                Plazo cerrado automáticamente
              </span>
            ) : (
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold shadow-xs ${
                  isBautizo
                    ? "bg-white dark:bg-sky-400/20 text-[#144254] dark:text-sky-100 dark:border dark:border-sky-400/35"
                    : "bg-[#ffedd5] text-[#c2410c]"
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
        <div className="bg-white border border-[#ebd9c4] rounded-2xl p-5 sm:p-6 shadow-xs space-y-3.5">
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
          <div className="w-full bg-[#fbf8f4] border border-[#ebd9c4] h-3.5 rounded-full overflow-hidden p-0.5 flex">
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
          <div className="flex flex-wrap items-center gap-4 text-[11px] text-stone-600 pt-1 border-t border-[#f5ede2]">
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
          {/* 1. Asignados (Pastel Celeste/Azul cielo sólido) */}
          <LoadingLink
            href="/dashboard/invitados"
            title="Ver todos los invitados asignados"
            className="bg-[#e0f2fe] dark:bg-[#0c2340] border border-[#7dd3fc] dark:border-[#1d4ed8]/50 rounded-2xl p-5 shadow-xs hover:border-sky-500 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-sky-800 dark:text-sky-300 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider group-hover:text-sky-950 dark:group-hover:text-white transition-colors">
                  Asignados
                </span>
                <Users className="w-4 h-4 text-sky-600 dark:text-sky-400 group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-3xl sm:text-4xl font-serif font-bold text-sky-950 dark:text-sky-100">
                {total_asignados}
              </p>
              <p className="text-xs text-sky-800/80 dark:text-sky-300/80 mt-1 font-medium">
                Pases totales repartidos
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-sky-300/60 dark:border-sky-800/60 flex items-center justify-between text-[11px] font-semibold text-sky-800 dark:text-sky-300">
              <span>Ver todos</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </div>
          </LoadingLink>

          {/* 2. Confirmados (Pastel Menta/Esmeralda sólido) */}
          <LoadingLink
            href="/dashboard/invitados?estado=confirmado"
            title="Ver invitados que ya confirmaron asistencia"
            className="bg-[#dcfce7] dark:bg-[#0c2f24] border border-[#86efac] dark:border-[#059669]/50 rounded-2xl p-5 shadow-xs hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider group-hover:text-emerald-950 dark:group-hover:text-white transition-colors">
                  Confirmados
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-3xl sm:text-4xl font-serif font-bold text-emerald-950 dark:text-emerald-100">
                {total_confirmados}
              </p>

              {/* Etiquetas destacadas de adultos y niños */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-white/90 dark:bg-[#134032] text-emerald-950 dark:text-emerald-200 border border-emerald-300/80 dark:border-emerald-700 font-medium shadow-xs">
                  <span>👤</span>
                  <span>
                    <strong className="font-bold text-sm text-emerald-950 dark:text-white">
                      {total_adultos}
                    </strong>{" "}
                    {total_adultos === 1 ? "adulto" : "adultos"}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-white/90 dark:bg-[#382b13] text-amber-950 dark:text-amber-200 border border-amber-300/80 dark:border-amber-700 font-medium shadow-xs">
                  <span>🧒</span>
                  <span>
                    <strong className="font-bold text-sm text-amber-950 dark:text-white">
                      {total_ninos}
                    </strong>{" "}
                    {total_ninos === 1 ? "niño" : "niños"}
                  </span>
                </span>
              </div>

              {/* Barra fina visual de proporción */}
              {total_confirmados > 0 && (
                <div className="w-full bg-emerald-200/80 dark:bg-emerald-950 h-1.5 rounded-full overflow-hidden flex mt-2.5">
                  <div
                    title={`${total_adultos} adultos`}
                    className="bg-emerald-600 dark:bg-emerald-400 h-full transition-all"
                    style={{
                      width: `${(total_adultos / total_confirmados) * 100}%`,
                    }}
                  />
                  <div
                    title={`${total_ninos} niños`}
                    className="bg-amber-500 dark:bg-amber-400 h-full transition-all"
                    style={{
                      width: `${(total_ninos / total_confirmados) * 100}%`,
                    }}
                  />
                </div>
              )}
            </div>
            <div className="mt-3 pt-2.5 border-t border-emerald-300/60 dark:border-emerald-800/60 flex items-center justify-between text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
              <span>Ver quiénes van</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </div>
          </LoadingLink>

          {/* 3. Pases Liberados / Declinados (Pastel Coral/Rosa sólido) */}
          <LoadingLink
            href="/dashboard/invitados?estado=liberados"
            title="Ver invitados que liberaron pases (declinados o confirmación parcial)"
            className="bg-[#ffe4e6] dark:bg-[#34141e] border border-[#fda4af] dark:border-[#e11d48]/50 rounded-2xl p-5 shadow-xs hover:border-rose-500 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-rose-800 dark:text-rose-300 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider group-hover:text-rose-950 dark:group-hover:text-white transition-colors">
                  Pases Liberados
                </span>
                <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-3xl sm:text-4xl font-serif font-bold text-rose-950 dark:text-rose-100">
                {total_pases_liberados}
              </p>
              <p className="text-xs text-rose-800/90 dark:text-rose-300/80 mt-1 font-medium leading-relaxed">
                {`${porLiberar} disponibles para liberar de quienes declinaron`}
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-rose-300/60 dark:border-rose-800/60 flex items-center justify-between text-[11px] font-semibold text-rose-800 dark:text-rose-300">
              <span>Ver quiénes liberaron</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </div>
          </LoadingLink>

          {/* 4. Pendientes (Pastel Miel/Ámbar cálido sólido) */}
          <LoadingLink
            href="/dashboard/invitados?estado=pendiente"
            title="Ver invitados que aún no confirman ni declinan"
            className="bg-[#fef3c7] dark:bg-[#33220c] border border-[#fcd34d] dark:border-[#d97706]/50 rounded-2xl p-5 shadow-xs hover:border-amber-500 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-amber-800 dark:text-amber-300 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider group-hover:text-amber-950 dark:group-hover:text-white transition-colors">
                  Pendientes
                </span>
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-3xl sm:text-4xl font-serif font-bold text-amber-950 dark:text-amber-100">
                {total_pendientes}
              </p>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-1 font-medium">
                Aún sin respuesta
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-amber-300/60 dark:border-amber-800/60 flex items-center justify-between text-[11px] font-semibold text-amber-800 dark:text-amber-300">
              <span>Ver quiénes faltan</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </div>
          </LoadingLink>        </div>
      </div>

      {qrCheckinEnabled && (
        <section className="rounded-3xl border border-[#d7e8df] dark:border-[#20315c] bg-[#f7fbf8] dark:bg-[#111c38] p-5 shadow-xs sm:p-6">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[.2em] text-emerald-700 dark:text-emerald-400">Control de acceso QR</p>
              <h2 className="mt-1 font-serif text-2xl font-bold text-[#183126] dark:text-white">Asistencia en el evento</h2>
              <p className="mt-1 text-xs text-stone-500 dark:text-slate-300">Pulsa Actualizar asistencia para consultar las últimas entradas.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <AttendanceRefresh />
              <LoadingLink href="/dashboard/invitados?entrada=ingresaron" className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300">Ver entradas <ArrowRight className="h-3.5 w-3.5" /></LoadingLink>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <LoadingLink href="/dashboard/invitados?entrada=ingresaron" className="dark-preserve rounded-2xl border border-emerald-200 dark:border-emerald-500/40 bg-white dark:bg-[#0c2e24] p-4 transition hover:border-emerald-400 hover:shadow-sm">
              <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300"><span className="text-[11px] font-bold uppercase tracking-wider">Ya ingresaron</span><DoorOpen className="h-4 w-4" /></div>
              <p className="mt-2 font-serif text-3xl font-bold text-emerald-950 dark:text-emerald-100">{total_ingresados}</p>
              <p className="mt-1 text-xs text-stone-500 dark:text-emerald-200/80">personas registradas</p>
            </LoadingLink>
            <LoadingLink href="/dashboard/invitados?entrada=sin_ingreso" className="dark-preserve rounded-2xl border border-amber-200 dark:border-amber-500/40 bg-white dark:bg-[#33220c] p-4 transition hover:border-amber-400 hover:shadow-sm">
              <div className="flex items-center justify-between text-amber-700 dark:text-amber-300"><span className="text-[11px] font-bold uppercase tracking-wider">Pendientes de llegar</span><ScanLine className="h-4 w-4" /></div>
              <p className="mt-2 font-serif text-3xl font-bold text-amber-950 dark:text-amber-100">{confirmados_pendientes_ingreso}</p>
              <p className="mt-1 text-xs text-stone-500 dark:text-amber-200/80">pases confirmados pendientes</p>
            </LoadingLink>
            <LoadingLink href="/dashboard/invitados?entrada=ingresaron" className="dark-preserve rounded-2xl border border-sky-200 dark:border-sky-500/40 bg-white dark:bg-[#0f2942] p-4 transition hover:border-sky-400 hover:shadow-sm">
              <div className="flex items-center justify-between text-sky-700 dark:text-sky-300"><span className="text-[11px] font-bold uppercase tracking-wider">Familias recibidas</span><UserCheck className="h-4 w-4" /></div>
              <p className="mt-2 font-serif text-3xl font-bold text-sky-950 dark:text-sky-100">{familias_ingresadas}</p>
              <p className="mt-1 text-xs text-stone-500 dark:text-sky-200/80">registros con al menos una entrada</p>
            </LoadingLink>
          </div>
        </section>
      )}

      {/* Actividad Reciente */}
      <div className="bg-white border border-[#ebd9c4] rounded-3xl p-6 sm:p-8 shadow-xs">
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
