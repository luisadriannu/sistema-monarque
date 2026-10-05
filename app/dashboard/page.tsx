import Link from "next/link";
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
  TrendingUp,
  FileSpreadsheet,
  UserPlus,
  AlertCircle,
} from "lucide-react";
import { formatDateLongMx, formatDateMx, formatDateTimeMx } from "@/lib/utils";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const evento = await prisma.evento.findFirst({
    where: user.rol === "admin" ? {} : { usuario_id: user.id },
    include: {
      invitados: {
        orderBy: { actualizado_en: "desc" },
      },
    },
    orderBy: { creado_en: "desc" },
  });

  if (!evento) {
    return (
      <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center max-w-xl mx-auto my-12 shadow-sm">
        <Sparkles className="w-10 h-10 text-[#c5a059] mx-auto mb-3" />
        <h2 className="text-xl font-serif font-bold text-stone-900 mb-2">
          No tienes eventos registrados
        </h2>
        <p className="text-sm text-stone-600 mb-6">
          Comunícate con la administradora de Monarque para asignar tu evento de invitaciones digitales.
        </p>
      </div>
    );
  }

  const invitados = evento.invitados;

  // Cálculo estricto de KPIs según RF-25 y RN-05
  let total_asignados = 0;
  let total_confirmados = 0;
  let total_declinados = 0;
  let total_pendientes = 0;
  let pases_liberados = 0;

  for (const inv of invitados) {
    total_asignados += inv.pases_asignados;

    if (inv.estado === "confirmado") {
      const conf = inv.pases_confirmados || 0;
      total_confirmados += conf;
      pases_liberados += Math.max(0, inv.pases_asignados - conf);
    } else if (inv.estado === "declinado") {
      total_declinados += inv.pases_asignados;
      pases_liberados += inv.pases_asignados;
    } else {
      total_pendientes += inv.pases_asignados;
    }
  }

  const respondidosCount = invitados.filter(
    (i) => i.estado === "confirmado" || i.estado === "declinado"
  ).length;
  const tasaRespuesta =
    invitados.length > 0 ? Math.round((respondidosCount / invitados.length) * 100) : 0;

  const now = new Date();
  const fechaLimite = new Date(evento.fecha_limite_rsvp);
  const diffTime = fechaLimite.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const rsvpVencido = diffTime <= 0;

  // Invitados con respuesta reciente
  const ultimasRespuestas = invitados
    .filter((i) => i.ultima_respuesta_en)
    .sort((a, b) => (b.ultima_respuesta_en?.getTime() || 0) - (a.ultima_respuesta_en?.getTime() || 0))
    .slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Encabezado del Evento */}
      <div className="bg-white border border-[#e6d7c3] rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[#f3ede3] to-transparent rounded-bl-full pointer-events-none opacity-60" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs uppercase tracking-widest font-semibold text-[#ab8153]">
                Panel de Control de Pases
              </span>
              <span className="text-stone-300">•</span>
              <span className="text-xs text-stone-500 font-medium">Plan Elite</span>
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-stone-900 tracking-tight">
              {evento.nombre}
            </h1>
            <p className="text-stone-600 text-sm mt-1 font-medium">
              Anfitriones: <span className="text-stone-800">{evento.anfitriones}</span>
            </p>

            <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-stone-600">
              <div className="flex items-center gap-1.5 bg-[#faf8f5] px-3 py-1.5 rounded-lg border border-stone-200">
                <Calendar className="w-3.5 h-3.5 text-[#ab8153]" />
                <span>Fecha del evento: {formatDateLongMx(evento.fecha_evento)}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-[#faf8f5] px-3 py-1.5 rounded-lg border border-stone-200">
                <MapPin className="w-3.5 h-3.5 text-[#ab8153]" />
                <span className="truncate max-w-xs">{evento.lugar}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/dashboard/invitados"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-900 hover:bg-[#946943] text-white text-xs font-semibold rounded-xl transition-all shadow-sm"
            >
              <UserPlus className="w-4 h-4 text-[#c5a059]" />
              <span>Gestionar Invitados</span>
            </Link>
            <Link
              href="/dashboard/exportar"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#faf8f5] hover:bg-[#f3ede3] text-stone-800 border border-stone-300 text-xs font-semibold rounded-xl transition-all"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#ab8153]" />
              <span>Lista Banquetero</span>
            </Link>
          </div>
        </div>

        {/* Alerta de Fecha Límite */}
        <div className="mt-6 pt-6 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle
              className={`w-4 h-4 shrink-0 ${
                rsvpVencido ? "text-rose-500" : diffDays <= 5 ? "text-amber-500" : "text-[#ab8153]"
              }`}
            />
            <span className="text-stone-700">
              Fecha límite de confirmación (RSVP):{" "}
              <strong>{formatDateMx(evento.fecha_limite_rsvp)}</strong>
            </span>
          </div>

          <div>
            {rsvpVencido ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800">
                Plazo cerrado automáticamente (botón bloqueado para invitados)
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                Plazo abierto: quedan {diffDays} {diffDays === 1 ? "día" : "días"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* RF-25: Tarjetas de KPIs principales */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs uppercase tracking-wider font-bold text-stone-500">
            Métricas de Pases y Asistencia (KPIs)
          </h2>
          <span className="text-xs text-stone-500">
            {invitados.length} invitados o familias registradas
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* Total Asignados */}
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm hover:border-[#c5a059] transition-colors">
            <div className="flex items-center justify-between text-stone-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Asignados</span>
              <Users className="w-4 h-4 text-stone-400" />
            </div>
            <p className="text-3xl font-serif font-bold text-stone-900">{total_asignados}</p>
            <p className="text-[11px] text-stone-500 mt-1">Pases totales reservados</p>
          </div>

          {/* Confirmados */}
          <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-emerald-700 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Confirmados</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-3xl font-serif font-bold text-emerald-900">{total_confirmados}</p>
            <p className="text-[11px] text-emerald-700 mt-1">Platillos a pagar confirmados</p>
          </div>

          {/* Declinados */}
          <div className="bg-rose-50/50 border border-rose-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-rose-700 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Declinados</span>
              <XCircle className="w-4 h-4 text-rose-600" />
            </div>
            <p className="text-3xl font-serif font-bold text-rose-900">{total_declinados}</p>
            <p className="text-[11px] text-rose-700 mt-1">No asistirán al evento</p>
          </div>

          {/* Pendientes (incluye Visto) */}
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-stone-600 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Pendientes</span>
              <Clock className="w-4 h-4 text-stone-400" />
            </div>
            <p className="text-3xl font-serif font-bold text-stone-900">{total_pendientes}</p>
            <p className="text-[11px] text-stone-500 mt-1">Sin respuesta definitiva</p>
          </div>

          {/* Pases Liberados (RN-05) */}
          <div className="bg-[#faf8f5] border border-[#d5bc9d] rounded-2xl p-5 shadow-sm col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-[#795337] mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Liberados</span>
              <Sparkles className="w-4 h-4 text-[#c5a059]" />
            </div>
            <p className="text-3xl font-serif font-bold text-[#53392a]">{pases_liberados}</p>
            <p className="text-[11px] text-[#795337] mt-1">Disponibles para reasignar</p>
          </div>
        </div>
      </div>

      {/* Progreso de respuestas y Actividad reciente */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Barra de progreso visual */}
        <div className="bg-white border border-stone-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif font-semibold text-lg text-stone-900">
                Tasa de Respuesta
              </h3>
              <TrendingUp className="w-5 h-5 text-[#c5a059]" />
            </div>
            <p className="text-xs text-stone-500 mb-6">
              Porcentaje de familias e invitados que ya han confirmado o declinado su asistencia.
            </p>

            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-4xl font-serif font-bold text-stone-900">{tasaRespuesta}%</span>
              <span className="text-xs text-stone-500">
                ({respondidosCount} de {invitados.length} invitados)
              </span>
            </div>

            {/* Progress bar visual */}
            <div className="w-full bg-stone-100 rounded-full h-3 overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full transition-all duration-500"
                style={{
                  width: `${
                    total_asignados > 0 ? (total_confirmados / total_asignados) * 100 : 0
                  }%`,
                }}
                title={`Confirmados: ${total_confirmados}`}
              />
              <div
                className="bg-rose-400 h-full transition-all duration-500"
                style={{
                  width: `${
                    total_asignados > 0 ? (total_declinados / total_asignados) * 100 : 0
                  }%`,
                }}
                title={`Declinados: ${total_declinados}`}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-stone-500 mt-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {total_confirmados} Confirmados
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                {total_declinados} Declinados
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-stone-300" />
                {total_pendientes} Pendientes
              </span>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-stone-100">
            <Link
              href="/dashboard/invitados"
              className="text-xs font-semibold text-[#946943] hover:text-stone-900 flex items-center justify-between group"
            >
              <span>Ver listado completo con filtros</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Actividad Reciente (RF-28) */}
        <div className="lg:col-span-2 bg-white border border-stone-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif font-semibold text-lg text-stone-900">
                Últimas Respuestas Recibidas
              </h3>
              <Clock className="w-5 h-5 text-stone-400" />
            </div>

            {ultimasRespuestas.length === 0 ? (
              <div className="text-center py-10 text-stone-400 text-xs">
                Aún no hay respuestas registradas. Envía los links por WhatsApp para comenzar a recibir confirmaciones.
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {ultimasRespuestas.map((inv) => (
                  <div key={inv.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-stone-900">{inv.nombre}</p>
                      <p className="text-xs text-stone-500">
                        {inv.grupo || "General"} • Respondido:{" "}
                        {formatDateTimeMx(inv.ultima_respuesta_en)}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-medium text-stone-700">
                        {inv.pases_confirmados ?? 0} de {inv.pases_asignados} pases
                      </span>
                      {inv.estado === "confirmado" ? (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                          Confirmado
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800">
                          Declinado
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 pt-6 border-t border-stone-100 flex items-center justify-between text-xs">
            <span className="text-stone-500">
              Pases liberados listos para ser reasignados a otros invitados
            </span>
            <Link
              href="/dashboard/invitados"
              className="font-semibold text-stone-900 hover:text-[#946943]"
            >
              Ir a Invitados →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
