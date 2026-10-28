"use client";
import AsyncButton from "@/components/AsyncButton";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Calendar,
  MessageSquare,
  Save,
  CheckCircle,
  AlertCircle,
  CalendarClock,
  Link2,
  TicketCheck,
  UserRound,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  toDateInputValue,
  endOfDayMexicoDate,
  formatDateMx,
  isEventFinished,
  toDateTimeInputValue,
} from "@/lib/utils";
import DashboardLoader from "@/components/DashboardLoader";

interface EventoConfig {
  id: string;
  nombre: string;
  anfitriones: string;
  fecha_evento: string;
  lugar: string;
  capacidad_total?: number | null;
  limite_pases?: number | null;
  total_confirmados?: number;
  total_comprometidos?: number;
  fecha_limite_rsvp: string;
  texto_edad_nino?: string;
  plantilla_mensaje: string;
  slug: string;
  estado: string;
  recepcion_abre_en?: string | null;
  recepcion_cierra_en?: string | null;
  modo_ingreso?: string;
}

const variablesMensaje = [
  {
    token: "{nombre}",
    label: "Nombre del invitado",
    example: "Familia Gómez Pérez",
    icon: UserRound,
    required: true,
  },
  {
    token: "{pases}",
    label: "Pases asignados",
    example: "4",
    icon: TicketCheck,
    required: true,
  },
  {
    token: "{link}",
    label: "Enlace personal",
    example: "Invitación única",
    icon: Link2,
    required: true,
  },
  {
    token: "{fecha_limite}",
    label: "Fecha límite",
    example: "30/12/2026",
    icon: CalendarClock,
    required: false,
  },
] as const;

function ConfiguracionContent() {
  const router = useRouter();
  const eventId = useSearchParams().get("evento_id");
  const [isAdmin, setIsAdmin] = useState(false);
  const [evento, setEvento] = useState<EventoConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states - Solo los campos configurables por la clienta
  const [capacidadTotal, setCapacidadTotal] = useState<string>("");
  const [fechaLimiteRsvp, setFechaLimiteRsvp] = useState("");
  const [textoEdadNino, setTextoEdadNino] = useState("menores de 12 años");
  const [plantillaMensaje, setPlantillaMensaje] = useState("");
  const [estadoEvento, setEstadoEvento] = useState("publicado");
  const [recepcionAbreEn, setRecepcionAbreEn] = useState("");
  const [recepcionCierraEn, setRecepcionCierraEn] = useState("");
  const [modoIngreso, setModoIngreso] = useState("parcial");
  const [minReceptionDate, setMinReceptionDate] = useState("");
  const [minDeadlineDate, setMinDeadlineDate] = useState("");
  const [qrCheckinEnabled, setQrCheckinEnabled] = useState(false);
  const mensajeRef = useRef<HTMLTextAreaElement>(null);
  const plantillaMensajeRef = useRef("");
  const cursorMensajeRef = useRef<number | null>(null);

  useEffect(() => {
    const updateMinimum = () => {
      setMinReceptionDate(
        toDateTimeInputValue(
          new Date(Math.floor(Date.now() / 60000) * 60000 + 60000),
        ),
      );
      setMinDeadlineDate(toDateInputValue(new Date()));
    };
    updateMinimum();
    const interval = window.setInterval(updateMinimum, 30000);
    window.addEventListener("focus", updateMinimum);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", updateMinimum);
    };
  }, []);

  useEffect(() => {
    plantillaMensajeRef.current = plantillaMensaje;
  }, [plantillaMensaje]);

  useEffect(() => {
    let active = true;
    async function loadEvento() {
      setLoading(true);
      setEvento(null);
      try {
        const res = await fetch(
          `/api/eventos${eventId ? `?evento_id=${encodeURIComponent(eventId)}` : ""}`,
          { cache: "no-store" },
        );
        const data = await res.json();
        if (!active) return;
        if (!res.ok)
          throw new Error(data.error || "No se pudo cargar el evento.");
        setIsAdmin(Boolean(data.permisos?.administrador));
        if (data.permisos?.administrador && !eventId) return;
        setQrCheckinEnabled(Boolean(data.permisos?.qr_checkin_habilitado));
        if (res.ok && data.eventos?.[0]) {
          const ev = data.eventos[0];
          setEvento(ev);
          setCapacidadTotal(
            ev.capacidad_total !== null && ev.capacidad_total !== undefined
              ? String(ev.capacidad_total)
              : "",
          );
          setTextoEdadNino(ev.texto_edad_nino || "menores de 12 años");
          setFechaLimiteRsvp(toDateInputValue(ev.fecha_limite_rsvp));
          setPlantillaMensaje(
            ev.plantilla_mensaje ||
              "¡Hola {nombre}! Te invitamos con mucho cariño a nuestro evento. Tienes {pases} pases reservados. Por favor confírmanos tu asistencia aquí: {link}",
          );
          setEstadoEvento(ev.estado || "publicado");
          setRecepcionAbreEn(
            ev.recepcion_abre_en
              ? toDateTimeInputValue(ev.recepcion_abre_en)
              : "",
          );
          setRecepcionCierraEn(
            ev.recepcion_cierra_en
              ? toDateTimeInputValue(ev.recepcion_cierra_en)
              : "",
          );
          setModoIngreso(
            data.permisos?.administrador
              ? ev.modo_ingreso || "parcial"
              : "parcial",
          );
        }
      } catch (e) {
        if (active)
          setError(
            e instanceof Error ? e.message : "No se pudo cargar el evento.",
          );
      } finally {
        if (active) setLoading(false);
      }
    }

    loadEvento();
    return () => {
      active = false;
    };
  }, [eventId]);

  const fechaEventoMaxima = evento ? toDateInputValue(evento.fecha_evento) : "";
  const fechaMinimaRsvp = minDeadlineDate || toDateInputValue(new Date());
  const fechaLimitePosteriorEvento = Boolean(
    fechaLimiteRsvp && fechaEventoMaxima && fechaLimiteRsvp > fechaEventoMaxima,
  );
  const fechaLimiteAnteriorHoy = Boolean(
    fechaLimiteRsvp && minDeadlineDate && fechaLimiteRsvp < minDeadlineDate,
  );
  const fechaLimiteInvalida =
    fechaLimiteAnteriorHoy || fechaLimitePosteriorEvento;
  const eventoFinalizado =
    evento && !isAdmin ? isEventFinished(evento.fecha_evento) : false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (guardando) return;
    if (!evento) return;
    setError(null);
    setMensajeExito(false);

    if (eventoFinalizado) {
      setError(
        "El evento ya finalizó. La configuración está disponible únicamente para consulta.",
      );
      return;
    }

    if (fechaLimiteRsvp && fechaLimiteRsvp < toDateInputValue(new Date())) {
      setError(
        "La fecha límite de confirmación no puede ser anterior a hoy (horario de Ciudad de México).",
      );
      return;
    }
    if (fechaLimitePosteriorEvento) {
      setError(
        `La fecha límite de confirmación no puede ser posterior al día del evento (${formatDateMx(evento.fecha_evento)}).`,
      );
      return;
    }
    if (fechaLimiteAnteriorHoy) {
      setError(
        "La fecha límite de confirmación debe ser hoy o una fecha futura.",
      );
      return;
    }

    if (capacidadTotal.trim() && Number(capacidadTotal) < (evento.total_confirmados ?? 0)) {
      setError(`Ya tienes ${evento.total_confirmados} asistentes confirmados. La capacidad no puede ser menor a ${evento.total_confirmados}.`);
      return;
    }
    if (
      evento.limite_pases &&
      capacidadTotal.trim() &&
      Number(capacidadTotal) > evento.limite_pases
    ) {
      setError(
        `Tu evento tiene un límite contratado de ${evento.limite_pases} pases.`,
      );
      return;
    }

    for (const [value, original, label] of [
      [recepcionAbreEn, evento.recepcion_abre_en, "apertura"],
      [recepcionCierraEn, evento.recepcion_cierra_en, "cierre"],
    ]) {
      if (
        value &&
        value !== toDateTimeInputValue(original) &&
        new Date(`${value}:00-06:00`).getTime() <= Date.now()
      ) {
        setError(
          `La fecha y hora de ${label} programado deben ser futuras (horario de Ciudad de México).`,
        );
        return;
      }
    }
    if (
      recepcionAbreEn &&
      recepcionCierraEn &&
      recepcionCierraEn <= recepcionAbreEn
    ) {
      setError(
        "La hora de cierre debe ser posterior a la apertura de recepción.",
      );
      return;
    }

    setGuardando(true);

    try {
      // Fecha límite se cierra al final de ese día en horario de México (23:59:59)
      const fechaLimiteEndOfDay = endOfDayMexicoDate(fechaLimiteRsvp);

      const res = await fetch("/api/eventos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: evento.id,
          capacidad_total: capacidadTotal.trim()
            ? parseInt(capacidadTotal, 10)
            : null,
          fecha_limite_rsvp: fechaLimiteEndOfDay.toISOString(),
          texto_edad_nino: textoEdadNino.trim() || "menores de 12 años",
          plantilla_mensaje: plantillaMensaje,
          estado: estadoEvento,
          ...(isAdmin && {
            recepcion_abre_en: recepcionAbreEn
              ? new Date(`${recepcionAbreEn}:00-06:00`).toISOString()
              : null,
            recepcion_cierra_en: recepcionCierraEn
              ? new Date(`${recepcionCierraEn}:00-06:00`).toISOString()
              : null,
          }),
          modo_ingreso: modoIngreso,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al actualizar evento.");

      setEvento(data.evento);
      setFechaLimiteRsvp(toDateInputValue(data.evento.fecha_limite_rsvp));
      // El resumen pudo quedar almacenado al visitarlo antes de editar.
      // refresh invalida esa caché de navegación sin abandonar el formulario.
      router.refresh();
      setMensajeExito(true);
      setTimeout(() => setMensajeExito(false), 3500);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError("Error al guardar la configuración.");
    } finally {
      setGuardando(false);
    }
  };

  // Previsualización de texto con variables simuladas
  const previewMensaje = plantillaMensaje
    .replace(/{nombre}/g, "Familia Gómez Pérez")
    .replace(/{pases}/g, "4")
    .replace(/{fecha_limite}/g, formatDateMx(fechaLimiteRsvp))
    .replace(
      /{link}/g,
      `https://tudominio.com/${evento?.slug || "evento"}?id=x7k2p9qa`,
    );

  const variablesObligatoriasFaltantes = variablesMensaje.filter(
    (variable) =>
      variable.required && !plantillaMensaje.includes(variable.token),
  );
  const variablesDuplicadas = variablesMensaje.filter(
    (variable) => plantillaMensaje.split(variable.token).length - 1 > 1,
  );

  const insertarVariable = (token: string) => {
    const textarea = mensajeRef.current;
    const mensajeActual = plantillaMensajeRef.current;
    const posicionExistente = mensajeActual.indexOf(token);

    if (posicionExistente >= 0) {
      cursorMensajeRef.current = posicionExistente + token.length;
      textarea?.focus();
      textarea?.setSelectionRange(
        posicionExistente,
        posicionExistente + token.length,
      );
      return;
    }

    const inicio = Math.min(
      cursorMensajeRef.current ??
        textarea?.selectionStart ??
        mensajeActual.length,
      mensajeActual.length,
    );
    const fin = Math.min(
      textarea?.selectionEnd ?? inicio,
      mensajeActual.length,
    );
    const necesitaEspacioAntes =
      inicio > 0 && !/\s/.test(mensajeActual.charAt(inicio - 1));
    const necesitaEspacioDespues =
      fin < mensajeActual.length && !/\s/.test(mensajeActual.charAt(fin));
    const insercion = `${necesitaEspacioAntes ? " " : ""}${token}${necesitaEspacioDespues ? " " : ""}`;
    const nuevoMensaje =
      mensajeActual.slice(0, inicio) + insercion + mensajeActual.slice(fin);
    const nuevaPosicion = inicio + insercion.length;

    plantillaMensajeRef.current = nuevoMensaje;
    cursorMensajeRef.current = nuevaPosicion;
    setPlantillaMensaje(nuevoMensaje);
    requestAnimationFrame(() => {
      mensajeRef.current?.focus();
      mensajeRef.current?.setSelectionRange(nuevaPosicion, nuevaPosicion);
    });
  };

  const limpiarVariablesDuplicadas = () => {
    let mensajeLimpio = plantillaMensaje;

    for (const variable of variablesMensaje) {
      const primeraPosicion = mensajeLimpio.indexOf(variable.token);
      if (primeraPosicion < 0) continue;

      const inicio = mensajeLimpio.slice(
        0,
        primeraPosicion + variable.token.length,
      );
      const resto = mensajeLimpio
        .slice(primeraPosicion + variable.token.length)
        .split(variable.token)
        .join("");
      mensajeLimpio = inicio + resto;
    }

    mensajeLimpio = mensajeLimpio
      .replace(/}(?={)/g, "} ")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
    plantillaMensajeRef.current = mensajeLimpio;
    cursorMensajeRef.current = mensajeLimpio.length;
    setPlantillaMensaje(mensajeLimpio);
    requestAnimationFrame(() => {
      mensajeRef.current?.focus();
      mensajeRef.current?.setSelectionRange(
        mensajeLimpio.length,
        mensajeLimpio.length,
      );
    });
  };

  if (loading) {
    return (
      <DashboardLoader
        title="Cargando configuración"
        message="Estamos preparando los ajustes de tu evento…"
        label="Cargando configuración del evento"
      />
    );
  }

  if (!evento) {
    return (
      <div className="p-8 text-center text-stone-600">
        No se encontró el evento.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="pointer-events-none fixed left-4 right-4 top-[calc(5.5rem+env(safe-area-inset-top))] z-[100] mx-auto max-w-md [overflow-anchor:none] lg:left-auto lg:right-6 lg:top-6 lg:mx-0 lg:w-full">
        <AnimatePresence>
          {(mensajeExito || error) && (
            <motion.div
              key={error ? "configuration-error" : "configuration-success"}
              role={error ? "alert" : "status"}
              aria-live={error ? "assertive" : "polite"}
              initial={{ opacity: 0, y: -18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.97 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className={`pointer-events-auto flex w-full items-start gap-3 rounded-2xl border p-4 shadow-[0_18px_55px_rgba(43,33,27,.22)] backdrop-blur-md ${
                error
                  ? "border-rose-200 bg-rose-50/95 text-rose-800"
                  : "border-emerald-200 bg-emerald-50/95 text-emerald-900"
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  error
                    ? "bg-rose-100 text-rose-600"
                    : "bg-emerald-100 text-emerald-600"
                }`}
              >
                {error ? (
                  <AlertCircle className="h-5 w-5" />
                ) : (
                  <CheckCircle className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">
                  {error
                    ? "No se guardaron los cambios"
                    : "Configuración guardada"}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed opacity-80">
                  {error || "Los cambios se actualizaron correctamente."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMensajeExito(false);
                  setError(null);
                }}
                aria-label="Cerrar notificación"
                className="shrink-0 rounded-lg p-1 opacity-55 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-current"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] uppercase tracking-widest font-semibold text-[#e05a1b]">
              Ajustes del Evento
            </span>
          </div>
          <h1 className="font-serif text-3xl font-bold text-[#2b211b]">
            Configuración
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Gestiona la fecha límite de confirmación, la capacidad de tu evento
            y el mensaje de invitación por WhatsApp
          </p>
        </div>
      </div>

      {eventoFinalizado && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-bold">
              Evento finalizado · Solo lectura
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-800/80">
              Puedes consultar estos ajustes, pero ya no es posible modificarlos
              después del día del evento.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5 pb-24">
        <fieldset
          disabled={eventoFinalizado}
          className="space-y-5 disabled:[&_button]:cursor-not-allowed disabled:[&_button]:opacity-60 disabled:[&_input]:cursor-not-allowed disabled:[&_textarea]:cursor-not-allowed"
        >
          {/* Parámetros de Asistencia y Capacidad */}
          <div className="bg-white border border-[#ebd9c4] rounded-3xl p-5 sm:p-7 shadow-xs space-y-5">
            <div className="flex items-center gap-2.5 pb-4 border-b border-[#f5ede2]">
              <Calendar className="w-5 h-5 text-[#e05a1b]" />
              <h2 className="font-serif text-lg font-bold text-[#2b211b]">
                Control de Asistencia y Capacidad
              </h2>
            </div>

            <div className="rounded-2xl border border-[#ebd9c4] bg-[#fffaf5] p-5">
              <div className="flex items-start gap-3">
                <CalendarClock className="mt-0.5 h-5 w-5 text-[#e05a1b]" />
                <div>
                  <h3 className="font-serif text-lg font-bold">
                    {qrCheckinEnabled && isAdmin
                      ? "Publicación y recepción"
                      : "Publicación de la invitación"}
                  </h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-stone-500">
                    {qrCheckinEnabled && isAdmin
                      ? "Controla si la invitación es visible y programa la ventana de recepción QR."
                      : "Controla si la invitación pública se encuentra disponible para tus invitados."}
                  </p>
                </div>
              </div>
              <div
                className={`mt-4 grid gap-4 md:grid-cols-2 ${qrCheckinEnabled ? (isAdmin ? "xl:grid-cols-4" : "xl:grid-cols-3") : "xl:grid-cols-1"}`}
              >
                <label className="text-xs font-bold uppercase tracking-wider">
                  Estado público
                  <select
                    value={estadoEvento}
                    onChange={(event) => setEstadoEvento(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-[#dec0a2] bg-white px-4 py-3 text-sm font-normal normal-case tracking-normal"
                  >
                    <option value="borrador">Borrador · no visible</option>
                    <option value="publicado">Publicado</option>
                    <option value="cancelado">Cancelado · no visible</option>
                    <option value="archivado">Archivado · no visible</option>
                  </select>
                </label>
                {qrCheckinEnabled && isAdmin && (
                  <>
                    <label className="text-xs font-bold uppercase tracking-wider">
                      Apertura programada
                      <input
                        type="datetime-local"
                        value={recepcionAbreEn}
                        min={
                          recepcionAbreEn &&
                          recepcionAbreEn ===
                            toDateTimeInputValue(evento.recepcion_abre_en)
                            ? recepcionAbreEn
                            : minReceptionDate
                        }
                        onChange={(event) =>
                          setRecepcionAbreEn(event.target.value)
                        }
                        className="mt-2 w-full rounded-xl border border-[#dec0a2] bg-white px-4 py-3 text-sm font-normal normal-case tracking-normal"
                      />
                      <span className="mt-1 block text-[10px] font-normal normal-case tracking-normal text-stone-500">
                        Horario de Ciudad de México.
                      </span>
                    </label>
                    <label className="text-xs font-bold uppercase tracking-wider">
                      Cierre programado
                      <input
                        type="datetime-local"
                        value={recepcionCierraEn}
                        min={
                          recepcionCierraEn &&
                          recepcionCierraEn ===
                            toDateTimeInputValue(evento.recepcion_cierra_en)
                            ? recepcionCierraEn
                            : [recepcionAbreEn, minReceptionDate].sort().at(-1)
                        }
                        onChange={(event) =>
                          setRecepcionCierraEn(event.target.value)
                        }
                        className="mt-2 w-full rounded-xl border border-[#dec0a2] bg-white px-4 py-3 text-sm font-normal normal-case tracking-normal"
                      />
                    </label>
                    {isAdmin && (
                      <label className="text-xs font-bold uppercase tracking-wider">
                        Uso del QR
                        <select
                          value={modoIngreso}
                          onChange={(event) =>
                            setModoIngreso(event.target.value)
                          }
                          className="mt-2 w-full rounded-xl border border-[#dec0a2] bg-white px-4 py-3 text-sm font-normal normal-case tracking-normal"
                        >
                          <option value="unico">Una sola llegada</option>
                          <option value="parcial">Llegadas separadas</option>
                        </select>
                        <span className="mt-1 block text-[10px] font-normal normal-case tracking-normal text-stone-500">
                          En modo parcial, la familia puede usar el QR hasta
                          completar sus pases.
                        </span>
                      </label>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Fecha Límite de Confirmación */}
              <div className="min-w-0 overflow-hidden bg-[#fbf8f4] p-5 rounded-2xl border border-[#ebd9c4] flex flex-col justify-between">
                <div className="min-w-0">
                  <label className="mb-2 flex min-w-0 flex-col items-start gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-900 sm:flex-row sm:items-center sm:justify-between">
                    <span className="min-w-0">
                      Fecha Límite de Confirmación (RSVP)
                    </span>
                    <span className="shrink-0 text-[10px] font-semibold lowercase tracking-normal text-[#e05a1b]">
                      cierre 23:59 hrs
                    </span>
                  </label>
                  <input
                    type="date"
                    required
                    max={fechaEventoMaxima}
                    value={fechaLimiteRsvp}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value && value < fechaMinimaRsvp) {
                        setError(
                          "La fecha límite de confirmación no puede ser anterior a hoy.",
                        );
                        return;
                      }
                      if (
                        value &&
                        fechaEventoMaxima &&
                        value > fechaEventoMaxima
                      ) {
                        setError(
                          `La fecha límite no puede ser posterior al evento (${formatDateMx(evento.fecha_evento)}).`,
                        );
                        return;
                      }
                      setFechaLimiteRsvp(value);
                      setError(null);
                    }}
                    aria-invalid={fechaLimitePosteriorEvento}
                    aria-describedby="fecha-limite-ayuda"
                    className={`block min-w-0 max-w-full w-full appearance-none box-border px-4 py-2.5 bg-white border rounded-xl text-sm focus:outline-none focus:ring-2 ${
                      fechaLimitePosteriorEvento
                        ? "border-rose-400 focus:ring-rose-400"
                        : "border-[#dec0a2] focus:ring-[#e05a1b]"
                    }`}
                  />
                </div>
                <p
                  id="fecha-limite-ayuda"
                  className={`text-[11px] mt-3 leading-relaxed ${
                    fechaLimitePosteriorEvento
                      ? "font-medium text-rose-600"
                      : "text-stone-600"
                  }`}
                >
                  {fechaLimitePosteriorEvento
                    ? `Selecciona una fecha igual o anterior al día del evento (${formatDateMx(evento.fecha_evento)}).`
                    : "Al concluir este día a las 23:59 hrs, el botón de confirmar se bloqueará automáticamente para los invitados. Si extiendes el plazo más adelante, solo cambia esta fecha y el sistema se reabrirá al instante."}
                </p>
              </div>

              {/* Capacidad / Cupo Total del Evento */}
              <div className="min-w-0 overflow-hidden bg-[#fbf8f4] p-5 rounded-2xl border border-[#ebd9c4] flex flex-col justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex min-w-0 flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                    <label className="block text-xs font-bold text-stone-900 uppercase tracking-wider">
                      Capacidad del Evento (Cupo de asientos)
                    </label>
                    <span className="shrink-0 text-[11px] text-[#e05a1b] font-semibold">
                      Opcional
                    </span>
                  </div>
                  <input
                    type="number"
                    min={Math.max(1, evento.total_confirmados ?? 0)}
                    max={evento.limite_pases || undefined}
                    aria-describedby="capacity-reservations"
                    value={capacidadTotal}
                    onWheel={(event) => event.currentTarget.blur()}
                    onChange={(e) => setCapacidadTotal(e.target.value)}
                    placeholder="ej. 100"
                    className="block min-w-0 max-w-full w-full box-border px-4 py-2.5 bg-white border border-[#dec0a2] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e05a1b]"
                  />
                </div>
                <p id="capacity-reservations" className="mt-3 text-xs leading-relaxed text-stone-600">{evento.total_confirmados ?? 0} asistentes confirmados · {Math.max(0, (evento.total_comprometidos ?? 0) - (evento.total_confirmados ?? 0))} lugares adicionales aún reservados. La capacidad debe cubrir al menos los confirmados.</p>
                {capacidadTotal.trim() && Number(capacidadTotal) < (evento.total_comprometidos ?? 0) && <p role="status" className="mt-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">{Number(capacidadTotal) < (evento.total_confirmados ?? 0) ? "No puedes guardar una capacidad inferior a los asistentes confirmados." : "Esta capacidad no cubre todos los lugares reservados. Revisa las invitaciones pendientes y los pases disponibles para liberar."}</p>}
                <p className="text-[11px] text-stone-600 mt-3 leading-relaxed">
                  {evento.limite_pases
                    ? `Tu contratación permite hasta ${evento.limite_pases} pases. `
                    : ""}
                  Si defines un cupo máximo, verás en tu Resumen una barra de
                  control que te indica cuántos cupos te quedan disponibles. Si
                  lo dejas vacío, no se mostrará.
                </p>
              </div>

              {/* Definición de Niño */}
              <div className="md:col-span-2 bg-[#fbf8f4] p-5 rounded-2xl border border-[#ebd9c4]">
                <label className="block text-xs font-bold text-stone-900 uppercase tracking-wider mb-1.5">
                  Definición de Niño para tu Evento
                </label>
                <div className="max-w-md">
                  <input
                    type="text"
                    required
                    value={textoEdadNino}
                    onChange={(e) => setTextoEdadNino(e.target.value)}
                    placeholder="ej. menores de 12 años"
                    className="w-full px-4 py-2.5 bg-white border border-[#dec0a2] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e05a1b]"
                  />
                </div>
                <p className="text-[11px] text-stone-600 mt-2 leading-relaxed">
                  Este texto aparecerá en la invitación cuando el invitado
                  indique cuántos de sus asistentes son niños (ej.
                  &quot;¿Cuántos de ellos son niños? (menores de 12
                  años)&quot;).
                </p>
              </div>
            </div>
          </div>

          {/* Mensaje de WhatsApp: vista previa primero, edición opcional. */}
          <section className="rounded-3xl border border-[#ebd9c4] bg-white p-5 shadow-xs sm:p-7">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><MessageSquare className="h-5 w-5"/></div>
              <div>
                <h2 className="font-serif text-xl font-bold text-[#2b211b]">Mensaje de WhatsApp para tus invitados</h2>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-stone-500">Este texto acompaña el enlace cuando compartes una invitación desde la lista de Invitados.</p>
              </div>
            </div>

            <div className="mt-5 grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="rounded-2xl bg-[#fbf8f4] p-4">
                  <p className="text-sm font-semibold text-stone-800">Tu mensaje ya está listo para compartir</p>
                  <p className="mt-2 text-sm leading-relaxed text-stone-500">El sistema pone el nombre, los pases y el enlace de cada invitado donde corresponde. Puedes dejar el texto actual o darle tu toque personal.</p>
                  <p className="mt-3 text-xs leading-relaxed text-stone-500">Aquí solo preparas el texto. Para enviarlo, entra a <strong>Invitados</strong> y elige <strong>WhatsApp</strong> en la persona o familia que deseas invitar.</p>
                </div>

                <details className="group rounded-2xl border border-stone-200">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-semibold text-stone-800 [&::-webkit-details-marker]:hidden">
                    <span>Personalizar mensaje <span className="font-normal text-stone-400">(opcional)</span></span>
                    <span className="text-emerald-700"><span className="group-open:hidden">Editar</span><span className="hidden group-open:inline">Cerrar</span></span>
                  </summary>
                  <div className="space-y-4 border-t border-stone-100 p-4">
                    <label htmlFor="plantilla-whatsapp" className="block text-sm font-semibold text-stone-800">Escribe con tus propias palabras</label>
                    <p id="mensaje-ayuda" className="text-xs leading-relaxed text-stone-500">Las etiquetas entre llaves se cambian por los datos de cada invitado al compartir. Consérvalas en el texto. Si borras alguna, puedes volver a añadirla con los botones.</p>
                    <textarea
                      ref={mensajeRef}
                      id="plantilla-whatsapp"
                      aria-describedby="mensaje-ayuda"
                      rows={7}
                      required
                      value={plantillaMensaje}
                      onChange={(e) => {
                        plantillaMensajeRef.current = e.target.value;
                        cursorMensajeRef.current = e.target.selectionStart;
                        setPlantillaMensaje(e.target.value);
                      }}
                      onSelect={(e) => { cursorMensajeRef.current = e.currentTarget.selectionStart; }}
                      className="w-full resize-y rounded-xl border border-stone-200 bg-[#fffdfb] p-4 text-sm leading-relaxed text-stone-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    />
                    <div>
                      <p className="mb-2 text-xs font-semibold text-stone-600">Añadir un dato al mensaje</p>
                      <div className="flex flex-wrap gap-2">{variablesMensaje.map(variable => {
                        const Icon = variable.icon;
                        const incluida = plantillaMensaje.includes(variable.token);
                        return <button key={variable.token} type="button" onClick={() => insertarVariable(variable.token)} title={incluida ? "Ver este dato en el texto" : `Añadir ${variable.label.toLowerCase()}`} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition ${incluida ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-stone-200 text-stone-600 hover:bg-stone-50"}`}><Icon className="h-3.5 w-3.5"/>{variable.label}{incluida && <CheckCircle className="h-3 w-3"/>}</button>;
                      })}</div>
                    </div>
                    {variablesObligatoriasFaltantes.length > 0 && <p role="status" className="rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">Tu texto no incluye: <strong>{variablesObligatoriasFaltantes.map(variable => variable.label.toLowerCase()).join(", ")}</strong>. Usa los botones para añadir esos datos.</p>}
                    {variablesDuplicadas.length > 0 && <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800"><p>Hay datos que aparecen más de una vez en tu texto.</p><button type="button" onClick={limpiarVariablesDuplicadas} className="mt-2 font-semibold underline underline-offset-2">Dejar cada dato una sola vez</button></div>}
                    <p className="text-xs text-stone-500">Al terminar, pulsa <strong>Guardar configuración</strong>.</p>
                  </div>
                </details>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-stone-800">Así se verá al compartir</p>
                  <p className="mt-1 text-xs text-stone-500">Ejemplo con Familia Gómez Pérez y 4 pases. Cada invitado recibirá sus propios datos.</p>
                </div>
                <div className="overflow-hidden rounded-2xl border border-[#d6d7d1] bg-[#e9e4dc]">
                  <div className="flex items-center gap-3 border-b border-stone-200 bg-[#f7f7f5] px-4 py-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><UserRound className="h-4 w-4"/></span>
                    <div><p className="text-sm font-semibold text-stone-800">Familia Gómez Pérez</p><p className="text-[11px] text-stone-400">Vista de ejemplo</p></div>
                  </div>
                  <div className="p-4 sm:p-5">
                    <div className="ml-auto max-w-[95%] rounded-2xl rounded-tr-sm bg-[#d9fdd3] px-4 py-3 shadow-sm">
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-stone-800">{previewMensaje || "Escribe un mensaje para ver el ejemplo aquí."}</p>
                      <div className="mt-2 flex justify-end gap-1 text-[10px] text-stone-500"><span>10:30 a. m.</span><span className="font-bold text-sky-500">✓✓</span></div>
                    </div>
                  </div>
                </div>
                <p className="flex items-start gap-2 text-xs leading-relaxed text-stone-500"><Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0"/>El enlace del ejemplo es ilustrativo. Al compartir se usa el enlace personal de cada invitado.</p>
              </div>
            </div>
          </section>

          {/* Botón de guardado */}
          <div className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 lg:left-[calc(16rem+2rem)] lg:right-8">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 rounded-2xl border border-[#ead7c4] bg-white/95 p-3 shadow-2xl shadow-stone-900/15 backdrop-blur-md">
              <div className="hidden min-w-0 sm:block">
                <p className="text-xs font-bold text-[#2b211b]">
                  Configuración del evento
                </p>
                <p className="truncate text-[10px] text-stone-500">
                  Guarda juntos todos los cambios realizados en esta página.
                </p>
              </div>
              <AsyncButton
                type="submit"
                disabled={
                  guardando ||
                  fechaLimiteAnteriorHoy ||
                  fechaLimitePosteriorEvento ||
                  eventoFinalizado
                }
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#e05a1b] to-[#ea580c] px-6 py-3 text-xs font-semibold text-white shadow-md shadow-orange-500/20 transition-all hover:from-[#c2410c] hover:to-[#e05a1b] disabled:opacity-50 sm:w-auto"
                loadingText="Guardando…"
                loading={guardando}
              >
                <Save className="w-4 h-4 text-white" />
                <span>
                  {guardando ? "Guardando cambios..." : "Guardar configuración"}
                </span>
              </AsyncButton>
            </div>
          </div>
        </fieldset>
      </form>
    </div>
  );
}

export default function ConfiguracionPage() {
  return (
    <Suspense fallback={<DashboardLoader label="Cargando configuración" />}>
      <ConfiguracionContent />
    </Suspense>
  );
}
