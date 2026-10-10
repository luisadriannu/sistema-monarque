import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  Users,
  CheckCircle2,
  Clock,
  Sparkles,
  Calendar,
  MapPin,
  ArrowRight,
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
      <div className="bg-white border border-[#ebd9c4] rounded-3xl p-8 text-center max-w-xl mx-auto my-12 shadow-sm">
        <Sparkles className="w-10 h-10 text-[#e05a1b] mx-auto mb-3" />
        <h2 className="text-xl font-serif font-bold text-stone-900 mb-2">
          No tienes eventos registrados
        </h2>
        <p className="text-xs text-stone-600 mb-6">
          Comunícate con la administradora de Monarque para asignar tu evento de invitaciones digitales.
        </p>
      </div>
    );
  }

  const invitados = evento.invitados;

  // Cálculo de los 4 números clave:
  // Asignados = Confirmados + Pendientes + Disponibles
  let total_asignados = 0;
  let total_confirmados = 0;
  let total_pendientes = 0;
  let total_disponibles = 0;

  for (const inv of invitados) {
    total_asignados += inv.pases_asignados;

    if (inv.estado === "confirmado") {
      const conf = inv.pases_confirmados || 0;
      total_confirmados += conf;
      // Pases sin usar de quien confirmó menos
      total_disponibles += Math.max(0, inv.pases_asignados - conf);
    } else if (inv.estado === "declinado") {
      // Todo el pase queda disponible al declinar
      total_disponibles += inv.pases_asignados;
    } else {
      // pendiente o visto
      total_pendientes += inv.pases_asignados;
    }
  }

  const now = new Date();
  const fechaLimite = new Date(evento.fecha_limite_rsvp);
  const diffTime = fechaLimite.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const rsvpVencido = diffTime <= 0;

  // Invitados con respuesta reciente para darle vida al panel
  const ultimasRespuestas = invitados
    .filter((i) => i.ultima_respuesta_en)
    .sort((a, b) => (b.ultima_respuesta_en?.getTime() || 0) - (a.ultima_respuesta_en?.getTime() || 0))
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
            <span className="text-xs text-stone-500 font-medium">Monarque Elite</span>
          </div>

          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#2b211b] tracking-tight">
            {evento.nombre}
          </h1>

          <p className="text-stone-600 text-sm mt-1 font-medium">
            Anfitriones: <span className="text-stone-800 font-semibold">{evento.anfitriones}</span>
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-4 text-xs text-stone-600">
            <div className="flex items-center gap-2 bg-[#fbf8f4] px-3.5 py-2 rounded-xl border border-[#ebd9c4]">
              <Calendar className="w-3.5 h-3.5 text-[#e05a1b]" />
              <span>Fecha del evento: <strong>{formatDateLongMx(evento.fecha_evento)}</strong></span>
            </div>
            <div className="flex items-center gap-2 bg-[#fbf8f4] px-3.5 py-2 rounded-xl border border-[#ebd9c4]">
              <MapPin className="w-3.5 h-3.5 text-[#e05a1b]" />
              <span className="truncate max-w-sm">{evento.lugar}</span>
            </div>
          </div>
        </div>

        {/* Alerta de Fecha Límite */}
        <div className="mt-6 pt-5 border-t border-[#f5ede2] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle
              className={`w-4 h-4 shrink-0 ${
                rsvpVencido ? "text-rose-500" : diffDays <= 5 ? "text-[#e05a1b]" : "text-[#c59b4c]"
              }`}
            />
            <span className="text-stone-700">
              Fecha límite de confirmación:{" "}
              <strong>{formatDateMx(evento.fecha_limite_rsvp)}</strong> (hasta las 23:59 hrs)
            </span>
          </div>

          <div>
            {rsvpVencido ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                Plazo cerrado automáticamente
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#ffedd5] text-[#c2410c]">
                Plazo abierto: quedan {diffDays} {diffDays === 1 ? "día" : "días"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 4 Métricas Clave (Sin números que se pisen) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs uppercase tracking-wider font-bold text-stone-500">
            Estado de Pases y Asistencia
          </h2>
          <span className="text-xs text-stone-500 font-medium">
            {invitados.length} familias e invitados registrados
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Asignados */}
          <div className="bg-white border border-[#ebd9c4] rounded-2xl p-5 shadow-xs hover:border-[#e05a1b] transition-colors">
            <div className="flex items-center justify-between text-stone-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Asignados</span>
              <Users className="w-4 h-4 text-stone-400" />
            </div>
            <p className="text-3xl sm:text-4xl font-serif font-bold text-[#2b211b]">{total_asignados}</p>
            <p className="text-xs text-stone-500 mt-1">Pases totales reservados</p>
          </div>

          {/* 2. Confirmados */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between text-emerald-700 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Confirmados</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-3xl sm:text-4xl font-serif font-bold text-emerald-950">{total_confirmados}</p>
            <p className="text-xs text-emerald-700 mt-1 font-medium">Platillos a pagar confirmados</p>
          </div>

          {/* 3. Pendientes */}
          <div className="bg-stone-50/80 border border-stone-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between text-stone-600 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Pendientes</span>
              <Clock className="w-4 h-4 text-stone-400" />
            </div>
            <p className="text-3xl sm:text-4xl font-serif font-bold text-stone-900">{total_pendientes}</p>
            <p className="text-xs text-stone-500 mt-1">Aún no confirman o han visto</p>
          </div>

          {/* 4. Disponibles (Declinados + Pases liberados) */}
          <div className="bg-[#fbf8f4] border border-[#dec0a2] rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between text-[#86583d] mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Disponibles</span>
              <Sparkles className="w-4 h-4 text-[#e05a1b]" />
            </div>
            <p className="text-3xl sm:text-4xl font-serif font-bold text-[#e05a1b]">{total_disponibles}</p>
            <p className="text-xs text-[#86583d] mt-1 font-medium">Pases listos para reasignar</p>
          </div>
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
            Aún no hay respuestas registradas. Comparte los links por WhatsApp para comenzar a recibir confirmaciones.
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {ultimasRespuestas.map((inv) => (
              <div key={inv.id} className="py-3.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#fbf8f4] border border-[#dec0a2] flex items-center justify-center font-serif font-bold text-[#2b211b] text-sm shrink-0">
                    {inv.nombre.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-stone-900">{inv.nombre}</p>
                    <p className="text-xs text-stone-500">
                      {inv.grupo || "General"} • Respondido: {formatDateTimeMx(inv.ultima_respuesta_en)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-semibold text-stone-800">
                    {inv.pases_confirmados ?? 0} de {inv.pases_asignados} pases
                  </span>
                  {inv.estado === "confirmado" ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                      Confirmó
                    </span>
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
