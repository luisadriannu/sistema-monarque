"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  Calendar,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { formatDateLongMx, formatDateMx } from "@/lib/utils";

interface InvitationData {
  invitado: {
    nombre: string;
    pases_asignados: number;
    pases_confirmados: number | null;
    ninos_confirmados?: number;
    estado: string;
    ultima_respuesta_en: string | null;
  };
  evento: {
    nombre: string;
    anfitriones: string;
    fecha_evento: string;
    lugar: string;
    fecha_limite_rsvp: string;
    texto_edad_nino?: string;
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

  // Marcar como "visto" SOLO cuando un navegador real con JavaScript carga la página
  // Los bots de previsualización de enlaces de WhatsApp no ejecutan este código.
  useEffect(() => {
    if (invitado.estado === "pendiente") {
      fetch("/api/rsvp", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
        .then((res) => res.json())
        .then((res) => {
          if (res.ok && res.estado === "visto") {
            setInvitado((prev) => ({ ...prev, estado: "visto" }));
          }
        })
        .catch(() => {});
    }
  }, [token, invitado.estado]);

  // Valor inicial del contador
  const [pasesSeleccionados, setPasesSeleccionados] = useState<number>(() => {
    if (initialInvitado.pases_confirmados !== null) {
      return initialInvitado.pases_confirmados;
    }
    return initialInvitado.pases_asignados;
  });

  const [ninosSeleccionados, setNinosSeleccionados] = useState<number>(() => {
    if (
      initialInvitado.ninos_confirmados !== undefined &&
      initialInvitado.ninos_confirmados !== null
    ) {
      return initialInvitado.ninos_confirmados;
    }
    return 0;
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
      const nuevo = pasesSeleccionados - 1;
      setPasesSeleccionados(nuevo);
      if (ninosSeleccionados > nuevo) {
        setNinosSeleccionados(nuevo);
      }
    }
  };

  const handleIncrementNinos = () => {
    if (ninosSeleccionados < pasesSeleccionados) {
      setNinosSeleccionados(ninosSeleccionados + 1);
    }
  };

  const handleDecrementNinos = () => {
    if (ninosSeleccionados > 0) {
      setNinosSeleccionados(ninosSeleccionados - 1);
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
          ninos_confirmados:
            maxPases >= 2 && pasesSeleccionados > 0 ? ninosSeleccionados : 0,
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
    <div className="min-h-screen bg-[#fbf8f4] flex flex-col items-center justify-center p-4 sm:p-6 py-12 relative overflow-hidden">
      {/* Resplandor decorativo con tonos cálidos de mariposa monarca */}
      <div className="absolute top-0 inset-x-0 h-48 bg-gradient-to-b from-[#f5ede2] via-[#fbf8f4]/60 to-transparent pointer-events-none" />
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-orange-200/30 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg bg-white border border-[#ebd9c4] rounded-3xl shadow-xl shadow-stone-200/50 overflow-hidden relative z-10">
        {/* Cabecera Editorial con Logo Monarque */}
        <div className="bg-[#fcfaf7] border-b border-[#ebd9c4]/70 px-6 pt-8 pb-7 text-center relative">
          <div className="w-20 h-20 rounded-full mx-auto mb-3 p-1 bg-white border border-[#ebd9c4] shadow-xs overflow-hidden flex items-center justify-center">
            <Image
              src="/logo.png"
              alt="Monarque Invitaciones"
              width={76}
              height={76}
              className="w-full h-full object-cover"
              priority
            />
          </div>

          <p className="text-[10px] uppercase tracking-widest text-[#e05a1b] font-semibold">
            Nuestra Celebración
          </p>

          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#2b211b] tracking-tight mt-1 mb-2">
            {evento.nombre}
          </h1>

          <p className="text-stone-600 text-sm font-medium">
            {evento.anfitriones}
          </p>

          <div className="h-[1px] w-20 bg-gradient-to-r from-transparent via-[#c59b4c] to-transparent mx-auto mt-4" />
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          {/* Detalles de fecha y lugar */}
          <div className="space-y-3 bg-[#fbf8f4] p-4 rounded-2xl border border-[#ebd9c4] text-xs text-stone-700">
            <div className="flex items-start gap-3">
              <Calendar className="w-4 h-4 text-[#e05a1b] shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-stone-900 block">Fecha del Evento:</span>
                <span>{formatDateLongMx(evento.fecha_evento)}</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-[#e05a1b] shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-stone-900 block">Lugar:</span>
                <span>{evento.lugar}</span>
              </div>
            </div>
          </div>

          {/* Saludo personalizado */}
          <div className="text-center py-2">
            <span className="text-xs text-[#e05a1b] font-semibold uppercase tracking-wider block mb-1">
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

          {/* Estado de respuesta previa */}
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
                      invitado.pases_confirmados === 1 ? "asistente" : "asistentes"
                    }${
                      invitado.pases_asignados >= 2 &&
                      (invitado.ninos_confirmados ?? 0) > 0
                        ? ` (${(invitado.pases_confirmados || 0) - (invitado.ninos_confirmados || 0)} adultos, ${invitado.ninos_confirmados} niños)`
                        : ""
                    }`
                  : "Declinado"}
              </span>
            </div>
          )}

          {/* Controles de Selección de Pases */}
          {!evento.expirado ? (
            <div className="space-y-4 pt-2">
              <div className="bg-[#fbf8f4] p-5 rounded-2xl border border-[#ebd9c4] text-center space-y-3">
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
                    <span className="font-serif text-4xl font-bold text-[#2b211b] block leading-none">
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
                    <span className="text-rose-700 font-semibold">
                      Indicarás que no podrás asistir al evento.
                    </span>
                  ) : pasesSeleccionados === 1 ? (
                    <span className="text-emerald-700 font-semibold">Confirmarás para 1 persona.</span>
                  ) : (
                    <span className="text-emerald-700 font-semibold">
                      Confirmarás para {pasesSeleccionados} personas.
                    </span>
                  )}
                </p>
              </div>

              {/* Selector de niños (RF-30: si el invitado tiene 2 o más pases asignados y asistirán 1 o más) */}
              {maxPases >= 2 && pasesSeleccionados > 0 && (
                <div className="bg-[#fbf8f4] p-5 rounded-2xl border border-[#ebd9c4] text-center space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider">
                      ¿Cuántos de ellos son niños?
                    </label>
                    <span className="text-[11px] text-[#e05a1b] font-medium block mt-0.5">
                      ({evento.texto_edad_nino || "menores de 12 años"})
                    </span>
                  </div>

                  {/* Contador interactivo de niños */}
                  <div className="flex items-center justify-center gap-4">
                    <button
                      type="button"
                      onClick={handleDecrementNinos}
                      disabled={ninosSeleccionados <= 0}
                      className="w-12 h-12 rounded-2xl bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 flex items-center justify-center font-bold text-lg disabled:opacity-30 disabled:cursor-not-allowed shadow-xs active:scale-95 transition-all"
                    >
                      -
                    </button>

                    <div className="w-20 text-center">
                      <span className="font-serif text-4xl font-bold text-[#2b211b] block leading-none">
                        {ninosSeleccionados}
                      </span>
                      <span className="text-[10px] text-stone-500 uppercase tracking-wider block mt-1">
                        de {pasesSeleccionados} máx.
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleIncrementNinos}
                      disabled={ninosSeleccionados >= pasesSeleccionados}
                      className="w-12 h-12 rounded-2xl bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 flex items-center justify-center font-bold text-lg disabled:opacity-30 disabled:cursor-not-allowed shadow-xs active:scale-95 transition-all"
                    >
                      +
                    </button>
                  </div>

                  {/* Desglose resumen */}
                  <p className="text-xs font-medium text-stone-600">
                    <span className="text-stone-800 font-semibold">
                      {pasesSeleccionados - ninosSeleccionados}{" "}
                      {pasesSeleccionados - ninosSeleccionados === 1 ? "adulto" : "adultos"}
                    </span>
                    <span className="mx-2 text-stone-400">·</span>
                    <span className="text-stone-800 font-semibold">
                      {ninosSeleccionados}{" "}
                      {ninosSeleccionados === 1 ? "niño" : "niños"}
                    </span>
                  </p>
                </div>
              )}

              {/* Botón de envío con gradiente mariposa monarca */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={enviando}
                className={`w-full py-4 px-6 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all duration-200 shadow-md flex items-center justify-center gap-2 ${
                  pasesSeleccionados === 0
                    ? "bg-rose-700 hover:bg-rose-800 text-white"
                    : "bg-gradient-to-r from-[#e05a1b] to-[#ea580c] hover:from-[#c2410c] hover:to-[#e05a1b] text-white shadow-orange-500/20"
                } disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99]`}
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
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    <span>
                      {yaRespondio ? "Actualizar Mi Asistencia" : "Confirmar Mi Asistencia"}
                    </span>
                  </>
                )}
              </button>

              <div className="text-center text-[11px] text-stone-500">
                Fecha límite para confirmar:{" "}
                <strong>{formatDateMx(evento.fecha_limite_rsvp)}</strong>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center space-y-2">
              <Clock className="w-6 h-6 text-amber-600 mx-auto" />
              <h3 className="font-serif font-bold text-stone-900 text-sm">
                Plazo de Confirmación Concluido
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                La fecha límite para confirmar tu asistencia concluyó el{" "}
                <strong>{formatDateMx(evento.fecha_limite_rsvp)}</strong>. Para cualquier detalle o
                cambio, por favor comunícate directamente con los anfitriones.
              </p>
            </div>
          )}
        </div>

        {/* Footer Monarque */}
        <div className="bg-[#fcfaf7] border-t border-stone-100 py-3 text-center">
          <p className="text-[10px] text-[#86583d] uppercase tracking-widest font-semibold flex items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#e05a1b]" />
            <span>Monarque • Invitaciones Web</span>
          </p>
        </div>
      </div>
    </div>
  );
}
