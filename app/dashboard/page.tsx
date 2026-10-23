import Link from "next/link";
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
} from "lucide-react";
import { formatDateLongMx, formatDateMx, formatDateTimeMx } from "@/lib/utils";
import EventTypeIcon from "@/components/EventTypeIcon";
import { eventTypeThemes, getEventTypeFromConfig } from "@/lib/event-theme";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.rol === "admin" || user.rol === "organizador") redirect("/dashboard/usuarios");

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

  for (const inv of invitados) {
    total_asignados += inv.pases_asignados;

    if (inv.estado === "confirmado") {
      const conf = inv.pases_confirmados || 0;
      total_confirmados += conf;
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
  const total_pases_liberados = total_declinados + total_liberados_parciales;

  const capacidad = evento.capacidad_total || 0;
  // Cupos comprometidos reales: Confirmados + Pendientes (quienes declinaron ya liberaron su lugar)
  const cuposComprometidos = total_confirmados + total_pendientes;
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
      {/* Tarjeta de Información del Evento (Limpia, sin botones repetidos) */}
      <div className="bg-white border border-[#ebd9c4] rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-[#ffedd5]/50 via-[#fbf8f4]/30 to-transparent rounded-bl-full pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] uppercase tracking-widest font-semibold text-[#e05a1b]">
              Control de Pases e Invitaciones
            </span>
            <span className="text-stone-300">•</span>
            <span className="text-xs text-stone-500 font-medium">
              Monarque Elite
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-sm sm:h-14 sm:w-14"
              style={{
                backgroundColor: eventTheme.soft,
                borderColor: eventTheme.softBorder,
                color: eventTheme.accentStrong,
              }}
            >
              <EventTypeIcon
                type={eventType}
                className="h-6 w-6 sm:h-7 sm:w-7"
                strokeWidth={1.7}
              />
            </div>
            <h1 className="font-serif text-3xl font-bold tracking-tight text-[#2b211b] sm:text-4xl">
              {evento.nombre}
            </h1>
          </div>

          <p className="text-stone-600 text-sm mt-1 font-medium">
            Anfitriones:{" "}
            <span className="text-stone-800 font-semibold">
              {evento.anfitriones}
            </span>
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-4 text-xs text-stone-600">
            <div className="flex items-center gap-2 bg-[#fbf8f4] px-3.5 py-2 rounded-xl border border-[#ebd9c4]">
              <Calendar className="w-3.5 h-3.5 text-[#e05a1b]" />
              <span>
                Fecha del evento:{" "}
                <strong>{formatDateLongMx(evento.fecha_evento)}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2 bg-[#fbf8f4] px-3.5 py-2 rounded-xl border border-[#ebd9c4]">
              <MapPin className="w-3.5 h-3.5 text-[#e05a1b]" />
              <span className="max-w-sm">{evento.lugar}</span>
            </div>
          </div>
        </div>

        {/* Alerta de Fecha Límite */}
        <div className="mt-6 pt-5 border-t border-[#f5ede2] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle
              className={`w-4 h-4 shrink-0 ${
                rsvpVencido
                  ? "text-rose-500"
                  : diffDays <= 5
                    ? "text-[#e05a1b]"
                    : "text-[#c59b4c]"
              }`}
            />
            <span className="text-stone-700">
              Fecha límite de confirmación:{" "}
              <strong>{formatDateMx(evento.fecha_limite_rsvp)}</strong> (hasta
              las 23:59 hrs)
            </span>
          </div>

          <div>
            {rsvpVencido ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                Plazo cerrado automáticamente
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#ffedd5] text-[#c2410c]">
                Plazo abierto: quedan {diffDays}{" "}
                {diffDays === 1 ? "día" : "días"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Barra de Capacidad del Evento (Dinámica y en tiempo real) */}
      {evento.capacidad_total && (
        <div className="bg-white border border-[#ebd9c4] rounded-2xl p-5 sm:p-6 shadow-xs space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-stone-600">
                  Capacidad del Evento
                </span>
                <span className="text-stone-300">•</span>
                <span className="text-xs font-bold text-[#2b211b]">
                  {evento.capacidad_total} asientos totales
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                {total_confirmados} confirmados • {total_pendientes} en espera
                de responder
              </p>
            </div>

            <div>
              {cuposDisponibles >= 0 ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#ffedd5] text-[#c2410c] border border-[#fed7aa]">
                  Te quedan {cuposDisponibles}{" "}
                  {cuposDisponibles === 1
                    ? "cupo disponible"
                    : "cupos disponibles"}
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                  Has sobrepasado la capacidad por {Math.abs(cuposDisponibles)}{" "}
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
                {Math.round(pctConfirmados)}%)
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
          {/* 1. Asignados */}
          <Link
            href="/dashboard/invitados"
            title="Ver todos los invitados asignados"
            className="bg-white border border-[#ebd9c4] rounded-2xl p-5 shadow-xs hover:border-[#e05a1b] hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-stone-500 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider group-hover:text-[#e05a1b] transition-colors">
                  Asignados
                </span>
                <Users className="w-4 h-4 text-stone-400 group-hover:text-[#e05a1b] transition-colors" />
              </div>
              <p className="text-3xl sm:text-4xl font-serif font-bold text-[#2b211b]">
                {total_asignados}
              </p>
              <p className="text-xs text-stone-500 mt-1">
                Pases totales repartidos
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-[#f5ede2] flex items-center justify-between text-[11px] font-semibold text-[#e05a1b]">
              <span>Ver todos</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* 2. Confirmados */}
          <Link
            href="/dashboard/invitados?estado=confirmado"
            title="Ver invitados que ya confirmaron asistencia"
            className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-5 shadow-xs hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-emerald-700 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider group-hover:text-emerald-950 transition-colors">
                  Confirmados
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-3xl sm:text-4xl font-serif font-bold text-emerald-950">
                {total_confirmados}
              </p>

              {/* Etiquetas destacadas de adultos y niños */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-emerald-100/90 text-emerald-900 border border-emerald-200 font-medium shadow-xs">
                  <span>👤</span>
                  <span>
                    <strong className="font-bold text-sm text-emerald-950">
                      {total_adultos}
                    </strong>{" "}
                    {total_adultos === 1 ? "adulto" : "adultos"}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-amber-100/90 text-amber-900 border border-amber-200 font-medium shadow-xs">
                  <span>🧒</span>
                  <span>
                    <strong className="font-bold text-sm text-amber-950">
                      {total_ninos}
                    </strong>{" "}
                    {total_ninos === 1 ? "niño" : "niños"}
                  </span>
                </span>
              </div>

              {/* Barra fina visual de proporción */}
              {total_confirmados > 0 && (
                <div className="w-full bg-emerald-100/60 h-1.5 rounded-full overflow-hidden flex mt-2.5">
                  <div
                    title={`${total_adultos} adultos`}
                    className="bg-emerald-600 h-full transition-all"
                    style={{
                      width: `${(total_adultos / total_confirmados) * 100}%`,
                    }}
                  />
                  <div
                    title={`${total_ninos} niños`}
                    className="bg-amber-500 h-full transition-all"
                    style={{
                      width: `${(total_ninos / total_confirmados) * 100}%`,
                    }}
                  />
                </div>
              )}
            </div>
            <div className="mt-3 pt-2.5 border-t border-emerald-200/60 flex items-center justify-between text-[11px] font-semibold text-emerald-800">
              <span>Ver quiénes van</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* 3. Pases Liberados / Declinados */}
          <Link
            href="/dashboard/invitados?estado=liberados"
            title="Ver invitados que liberaron pases (declinados o confirmación parcial)"
            className="bg-rose-50/70 border border-rose-200 rounded-2xl p-5 shadow-xs hover:border-rose-400 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-rose-700 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider group-hover:text-rose-950 transition-colors">
                  Pases Liberados
                </span>
                <XCircle className="w-4 h-4 text-rose-500 group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-3xl sm:text-4xl font-serif font-bold text-rose-950">
                {total_pases_liberados}
              </p>
              <p className="text-xs text-rose-700 mt-1 font-medium leading-relaxed">
                {total_liberados_parciales > 0
                  ? `${total_declinados} de declinados y ${total_liberados_parciales} de ${
                      total_parciales_count === 1 ? "parcial" : "parciales"
                    }`
                  : "Pases disponibles para reasignar"}
              </p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-rose-200/60 flex items-center justify-between text-[11px] font-semibold text-rose-800">
              <span>Ver quiénes liberaron</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* 4. Pendientes */}
          <Link
            href="/dashboard/invitados?estado=pendiente"
            title="Ver invitados que aún no confirman ni declinan"
            className="bg-stone-50/80 border border-stone-200 rounded-2xl p-5 shadow-xs hover:border-stone-400 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-stone-600 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider group-hover:text-stone-900 transition-colors">
                  Pendientes
                </span>
                <Clock className="w-4 h-4 text-stone-400 group-hover:scale-110 transition-transform" />
              </div>
              <p className="text-3xl sm:text-4xl font-serif font-bold text-stone-900">
                {total_pendientes}
              </p>
              <p className="text-xs text-stone-500 mt-1">Aún sin respuesta</p>
            </div>
            <div className="mt-3 pt-2.5 border-t border-stone-200/60 flex items-center justify-between text-[11px] font-semibold text-stone-700">
              <span>Ver quiénes faltan</span>
              <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </div>

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
          <Link
            href="/dashboard/invitados"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#e05a1b] hover:text-[#b8420f] transition-colors"
          >
            <span>Ver toda la lista</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
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
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                        Parcial
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                        Confirmó
                      </span>
                    )
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
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
