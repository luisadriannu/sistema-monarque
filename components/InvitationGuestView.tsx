"use client";

import { useState } from "react";
import {
  Sparkles,
  Calendar,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Heart,
  ChevronRight,
} from "lucide-react";
import { formatDateLongMx, formatDateMx } from "@/lib/utils";

interface InvitationData {
  invitado: {
    nombre: string;
    pases_asignados: number;
    pases_confirmados: number | null;
    estado: string;
    ultima_respuesta_en: string | null;
  };
  evento: {
    nombre: string;
    anfitriones: string;
    fecha_evento: string;
    lugar: string;
    fecha_limite_rsvp: string;
    expirado: boolean;
  };
}

export default function InvitationGuestView({
  data,
  token,
}: {
  data: InvitationData;
  token: string;
}) {
  const { evento, invitado: initialInvitado } = data;
  const [invitado, setInvitado] = useState(initialInvitado);

  // Valor inicial del contador
  const [pasesSeleccionados, setPasesSeleccionados] = useState<number>(() => {
    if (initialInvitado.pases_confirmados !== null) {
      return initialInvitado.pases_confirmados;
    }
    return initialInvitado.pases_asignados; // Por defecto asignamos el máximo
  });

  const [enviando, setEnviando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  const maxPases = invitado.pases_asignados;
  const yaRespondio = invitado.estado === "confirmado" || invitado.estado === "declinado";

  const handleIncrement = () => {
    if (pasesSeleccionados < maxPases) {
      setPasesSeleccionados(pasesSeleccionados + 1);
    }
  };

  const handleDecrement = () => {
    if (pasesSeleccionados > 0) {
      setPasesSeleccionados(pasesSeleccionados - 1);
    }
  };

  const handleSubmit = async () => {
    if (evento.expirado) return;
    setEnviando(true);
    setErrorEnvio(null);
    setMensajeExito(null);

    try {
      const res = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          pases_confirmados: pasesSeleccionados,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Ocurrió un error al guardar tu respuesta.");
      }

      setInvitado(resData.invitado);
      setMensajeExito(resData.mensaje);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorEnvio(err.message);
      } else {
        setErrorEnvio("Error al procesar tu confirmación.");
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] flex flex-col items-center justify-center p-4 sm:p-6 py-12 relative overflow-hidden">
      {/* Adornos de fondo */}
      <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-[#f3ede3] to-transparent pointer-events-none" />

      <div className="w-full max-w-lg bg-white border border-[#e6d7c3] rounded-3xl shadow-xl shadow-stone-200/50 overflow-hidden relative z-10">
        {/* Cabecera Editorial Monarque */}
        <div className="bg-[#fcfaf7] border-b border-[#f3ede3] px-6 py-8 text-center relative">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white border border-[#e6d7c3] text-[#c5a059] mb-3 shadow-xs">
            <Heart className="w-5 h-5 fill-[#e8d7b5] text-[#c5a059]" />
          </div>

          <p className="text-[10px] uppercase tracking-widest text-[#ab8153] font-semibold">
            Nuestra Celebración
          </p>

          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-stone-900 tracking-tight mt-1 mb-2">
            {evento.nombre}
          </h1>

          <p className="text-stone-600 text-sm font-medium">
            {evento.anfitriones}
          </p>

          <div className="h-[1px] w-20 bg-[#c5a059] mx-auto mt-4 opacity-70" />
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          {/* Detalles de fecha y lugar */}
          <div className="space-y-3 bg-[#faf8f5] p-4 rounded-2xl border border-stone-200/80 text-xs text-stone-700">
            <div className="flex items-start gap-3">
              <Calendar className="w-4 h-4 text-[#ab8153] shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-stone-900 block">Fecha del Evento:</span>
                <span>{formatDateLongMx(evento.fecha_evento)}</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-[#ab8153] shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-stone-900 block">Lugar:</span>
                <span>{evento.lugar}</span>
              </div>
            </div>
          </div>

          {/* Saludo personalizado RF-19 */}
          <div className="text-center py-2">
            <span className="text-xs text-[#ab8153] font-semibold uppercase tracking-wider block mb-1">
              Confirmación de Asistencia (RSVP)
            </span>
            <h2 className="font-serif text-2xl font-bold text-stone-900">
              ¡Hola, {invitado.nombre}!
            </h2>
            <p className="text-xs text-stone-600 mt-1">
              Tienes{" "}
              <strong className="text-stone-900 font-semibold">
                {invitado.pases_asignados}{" "}
                {invitado.pases_asignados === 1 ? "pase reservado" : "pases reservados"}
              </strong>{" "}
              con mucho cariño.
            </p>
          </div>

          {/* Mensajes de feedback */}
          {mensajeExito && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed font-medium">{mensajeExito}</div>
            </div>
          )}

          {errorEnvio && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed font-medium">{errorEnvio}</div>
            </div>
          )}

          {/* Estado de respuesta previa RF-22 */}
          {yaRespondio && !mensajeExito && (
            <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-2xl flex items-center justify-between text-xs">
              <span className="text-stone-500">Respuesta actual:</span>
              <span
                className={`font-semibold px-2.5 py-0.5 rounded-full ${
                  invitado.estado === "confirmado"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-rose-100 text-rose-800"
                }`}
              >
                {invitado.estado === "confirmado"
                  ? `${invitado.pases_confirmados} ${
                      invitado.pases_confirmados === 1 ? "pase confirmado" : "pases confirmados"
                    }`
                  : "Declinado"}
              </span>
            </div>
          )}

          {/* Controles de Selección de Pases RF-20 */}
          {!evento.expirado ? (
            <div className="space-y-4 pt-2">
              <div className="bg-[#faf8f5] p-5 rounded-2xl border border-[#e6d7c3] text-center space-y-3">
                <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider">
                  ¿Cuántas personas asistirán?
                </label>

                {/* Contador interactivo */}
                <div className="flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={handleDecrement}
                    disabled={pasesSeleccionados <= 0}
                    className="w-12 h-12 rounded-2xl bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 flex items-center justify-center font-bold text-lg disabled:opacity-30 disabled:cursor-not-allowed shadow-xs active:scale-95 transition-all"
                  >
                    -
                  </button>

                  <div className="w-20 text-center">
                    <span className="font-serif text-4xl font-bold text-stone-900 block leading-none">
                      {pasesSeleccionados}
                    </span>
                    <span className="text-[10px] text-stone-500 uppercase tracking-wider block mt-1">
                      de {maxPases} máx.
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleIncrement}
                    disabled={pasesSeleccionados >= maxPases}
                    className="w-12 h-12 rounded-2xl bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 flex items-center justify-center font-bold text-lg disabled:opacity-30 disabled:cursor-not-allowed shadow-xs active:scale-95 transition-all"
                  >
                    +
                  </button>
                </div>

                {/* Leyenda aclaratoria */}
                <p className="text-xs font-medium text-stone-600">
                  {pasesSeleccionados === 0 ? (
                    <span className="text-rose-700">
                      Indicarás que no podrás asistir a la celebración.
                    </span>
                  ) : pasesSeleccionados === 1 ? (
                    <span className="text-emerald-700">Confirmarás para 1 persona.</span>
                  ) : (
                    <span className="text-emerald-700">
                      Confirmarás para {pasesSeleccionados} personas.
                    </span>
                  )}
                </p>
              </div>

              {/* Botón de envío */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={enviando}
                className={`w-full py-4 px-6 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all duration-200 shadow-md flex items-center justify-center gap-2 ${
                  pasesSeleccionados === 0
                    ? "bg-rose-700 hover:bg-rose-800 text-white"
                    : "bg-stone-900 hover:bg-[#946943] text-white"
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {enviando ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : pasesSeleccionados === 0 ? (
                  <>
                    <XCircle className="w-4 h-4" />
                    <span>Confirmar que no podré asistir</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-[#c5a059]" />
                    <span>
                      {yaRespondio ? "Actualizar Mi Asistencia" : "Confirmar Mi Asistencia"}
                    </span>
                  </>
                )}
              </button>

              <div className="text-center text-[11px] text-stone-500">
                Fecha límite para cambios:{" "}
                <strong>{formatDateMx(evento.fecha_limite_rsvp)}</strong>
              </div>
            </div>
          ) : (
            /* RF-06: Bloqueo cuando vence la fecha límite */
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center space-y-2">
              <Clock className="w-6 h-6 text-amber-600 mx-auto" />
              <h3 className="font-serif font-bold text-stone-900 text-sm">
                Plazo de Confirmación Concluido
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                La fecha límite para confirmar tu asistencia venció el{" "}
                <strong>{formatDateMx(evento.fecha_limite_rsvp)}</strong>. Para cualquier detalle o
                cambio, por favor comunícate directamente con los anfitriones.
              </p>
            </div>
          )}
        </div>

        {/* Footer Monarque */}
        <div className="bg-[#faf8f5] border-t border-stone-100 py-3 text-center">
          <p className="text-[10px] text-stone-400 uppercase tracking-widest font-medium">
            Invitación Digital • Monarque
          </p>
        </div>
      </div>
    </div>
  );
}
