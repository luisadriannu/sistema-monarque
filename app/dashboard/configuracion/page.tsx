"use client";

import { useState, useEffect } from "react";
import {
  Calendar,
  MapPin,
  MessageSquare,
  Save,
  CheckCircle,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import {
  toDateInputValue,
  toDateTimeInputValue,
  endOfDayMexicoDate,
  formatDateMx,
} from "@/lib/utils";

interface EventoConfig {
  id: string;
  nombre: string;
  anfitriones: string;
  fecha_evento: string;
  lugar: string;
  fecha_limite_rsvp: string;
  plantilla_mensaje: string;
  plantilla_recordatorio: string;
  slug: string;
}

export default function ConfiguracionPage() {
  const [evento, setEvento] = useState<EventoConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [nombre, setNombre] = useState("");
  const [anfitriones, setAnfitriones] = useState("");
  const [fechaEvento, setFechaEvento] = useState("");
  const [lugar, setLugar] = useState("");
  const [fechaLimiteRsvp, setFechaLimiteRsvp] = useState("");
  const [plantillaMensaje, setPlantillaMensaje] = useState("");
  const [plantillaRecordatorio, setPlantillaRecordatorio] = useState("");

  useEffect(() => {
    async function loadEvento() {
      try {
        const res = await fetch("/api/eventos");
        const data = await res.json();
        if (res.ok && data.eventos?.[0]) {
          const ev = data.eventos[0];
          setEvento(ev);
          setNombre(ev.nombre || "");
          setAnfitriones(ev.anfitriones || "");
          setLugar(ev.lugar || "");

          // Conversión segura respetando zona horaria de México
          setFechaEvento(toDateTimeInputValue(ev.fecha_evento));
          setFechaLimiteRsvp(toDateInputValue(ev.fecha_limite_rsvp));

          setPlantillaMensaje(
            ev.plantilla_mensaje ||
              "¡Hola {nombre}! Te invitamos con mucho cariño a nuestro evento. Tienes {pases} pases reservados. Por favor confírmanos tu asistencia aquí: {link}"
          );
          setPlantillaRecordatorio(
            ev.plantilla_recordatorio ||
              "¡Hola {nombre}! Te recordamos con mucho cariño que la fecha límite para confirmar tu asistencia a nuestro evento está próxima ({pases} pases reservados). Por favor confírmanos aquí: {link}"
          );
        }
      } catch (e) {
        console.error("Error al cargar configuración", e);
      } finally {
        setLoading(false);
      }
    }

    loadEvento();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evento) return;
    setGuardando(true);
    setError(null);
    setMensajeExito(false);

    try {
      // Fecha límite se cierra al final de ese día en horario de México (23:59:59)
      const fechaLimiteEndOfDay = endOfDayMexicoDate(fechaLimiteRsvp);

      const res = await fetch("/api/eventos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: evento.id,
          nombre,
          anfitriones,
          fecha_evento: new Date(fechaEvento).toISOString(),
          lugar,
          fecha_limite_rsvp: fechaLimiteEndOfDay.toISOString(),
          plantilla_mensaje: plantillaMensaje,
          plantilla_recordatorio: plantillaRecordatorio,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al actualizar evento.");

      setMensajeExito(true);
      setTimeout(() => setMensajeExito(false), 3500);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError("Error al guardar la configuración.");
    } finally {
      setGuardando(false);
    }
  };

  // Previsualizaciones de texto con variables simuladas
  const previewMensaje = plantillaMensaje
    .replace(/{nombre}/g, "Familia Gómez Pérez")
    .replace(/{pases}/g, "4")
    .replace(/{fecha_limite}/g, formatDateMx(fechaLimiteRsvp))
    .replace(
      /{link}/g,
      `https://tudominio.com/${evento?.slug || "evento"}?id=x7k2p9qa`
    );

  const previewRecordatorio = plantillaRecordatorio
    .replace(/{nombre}/g, "Familia Gómez Pérez")
    .replace(/{pases}/g, "4")
    .replace(/{fecha_limite}/g, formatDateMx(fechaLimiteRsvp))
    .replace(
      /{link}/g,
      `https://tudominio.com/${evento?.slug || "evento"}?id=x7k2p9qa`
    );

  if (loading) {
    return (
      <div className="py-20 text-center text-stone-400 text-xs">
        Cargando configuración del evento...
      </div>
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
            Personaliza los datos principales, la fecha límite de confirmación y los mensajes de WhatsApp
          </p>
        </div>

        {mensajeExito && (
          <div className="flex items-center gap-2 px-3.5 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl animate-in fade-in">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>¡Configuración guardada correctamente!</span>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Datos Generales y Fechas */}
        <div className="bg-white border border-[#ebd9c4] rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-[#f5ede2]">
            <Calendar className="w-5 h-5 text-[#e05a1b]" />
            <h2 className="font-serif text-lg font-bold text-[#2b211b]">
              Datos Principales del Evento
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
                Nombre del Evento
              </label>
              <input
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="ej. Boda Ana & Luis / XV Años Sofía"
                className="w-full px-4 py-2.5 bg-[#fbf8f4] border border-[#ebd9c4] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e05a1b]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
                Nombres de los Anfitriones
              </label>
              <input
                type="text"
                required
                value={anfitriones}
                onChange={(e) => setAnfitriones(e.target.value)}
                placeholder="ej. Ana Martínez y Luis Rodríguez / Familia Gómez"
                className="w-full px-4 py-2.5 bg-[#fbf8f4] border border-[#ebd9c4] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e05a1b]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
                Fecha y Hora del Evento
              </label>
              <input
                type="datetime-local"
                required
                value={fechaEvento}
                onChange={(e) => setFechaEvento(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#fbf8f4] border border-[#ebd9c4] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e05a1b]"
              />
              <p className="text-[11px] text-stone-500 mt-1">
                Formato local en horario de México.
              </p>
            </div>

            {/* Fecha Límite de Confirmación */}
            <div className="bg-[#fbf8f4] p-4 rounded-2xl border border-[#ebd9c4]">
              <label className="block text-xs font-bold text-stone-900 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Fecha Límite de Confirmación (RSVP)</span>
                <span className="text-[10px] text-[#e05a1b] font-semibold lowercase">
                  cierre a las 23:59 hrs
                </span>
              </label>
              <input
                type="date"
                required
                value={fechaLimiteRsvp}
                onChange={(e) => setFechaLimiteRsvp(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-[#dec0a2] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e05a1b]"
              />
              <p className="text-[11px] text-stone-600 mt-2 leading-relaxed">
                Al terminar este día (23:59 hrs), el botón de confirmar se bloqueará automáticamente para los invitados. Si extiendes el plazo más adelante, solo cambia esta fecha y el sistema se reabrirá al instante.
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
                Lugar o Dirección Completa
              </label>
              <input
                type="text"
                required
                value={lugar}
                onChange={(e) => setLugar(e.target.value)}
                placeholder="ej. Hacienda San José, Carretera Cuernavaca-Acapulco Km 18, Morelos"
                className="w-full px-4 py-2.5 bg-[#fbf8f4] border border-[#ebd9c4] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e05a1b]"
              />
            </div>
          </div>
        </div>

        {/* Plantillas de Mensajes */}
        <div className="bg-white border border-[#ebd9c4] rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-[#f5ede2]">
            <MessageSquare className="w-5 h-5 text-[#e05a1b]" />
            <div>
              <h2 className="font-serif text-lg font-bold text-[#2b211b]">
                Plantillas de Mensajes para WhatsApp
              </h2>
              <p className="text-xs text-stone-500">
                Variables dinámicas disponibles:{" "}
                <code className="bg-[#fbf8f4] border border-[#ebd9c4] px-1.5 py-0.5 rounded text-[#e05a1b] font-semibold">
                  {"{nombre}"}
                </code>
                ,{" "}
                <code className="bg-[#fbf8f4] border border-[#ebd9c4] px-1.5 py-0.5 rounded text-[#e05a1b] font-semibold">
                  {"{pases}"}
                </code>
                ,{" "}
                <code className="bg-[#fbf8f4] border border-[#ebd9c4] px-1.5 py-0.5 rounded text-[#e05a1b] font-semibold">
                  {"{link}"}
                </code>
                ,{" "}
                <code className="bg-[#fbf8f4] border border-[#ebd9c4] px-1.5 py-0.5 rounded text-[#e05a1b] font-semibold">
                  {"{fecha_limite}"}
                </code>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Plantilla Principal */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider">
                1. Plantilla de Invitación Inicial
              </label>
              <textarea
                rows={4}
                required
                value={plantillaMensaje}
                onChange={(e) => setPlantillaMensaje(e.target.value)}
                className="w-full p-3.5 bg-[#fbf8f4] border border-[#ebd9c4] rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-[#e05a1b] font-mono leading-relaxed"
              />
              <div className="bg-[#fbf8f4] p-3 rounded-xl border border-[#ebd9c4] text-xs">
                <span className="font-semibold text-stone-500 text-[10px] uppercase block mb-1">
                  Vista Previa en WhatsApp:
                </span>
                <p className="text-stone-800 whitespace-pre-wrap leading-relaxed text-[11px]">
                  {previewMensaje}
                </p>
              </div>
            </div>

            {/* Plantilla de Recordatorio */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider">
                2. Plantilla de Recordatorio
              </label>
              <textarea
                rows={4}
                required
                value={plantillaRecordatorio}
                onChange={(e) => setPlantillaRecordatorio(e.target.value)}
                className="w-full p-3.5 bg-[#fbf8f4] border border-[#ebd9c4] rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-[#e05a1b] font-mono leading-relaxed"
              />
              <p className="text-[11px] text-stone-500">
                Se envía automáticamente a los invitados que aún no confirman.
              </p>
              <div className="bg-[#fbf8f4] p-3 rounded-xl border border-[#ebd9c4] text-xs">
                <span className="font-semibold text-stone-500 text-[10px] uppercase block mb-1">
                  Vista Previa en WhatsApp:
                </span>
                <p className="text-stone-800 whitespace-pre-wrap leading-relaxed text-[11px]">
                  {previewRecordatorio}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Botón de guardado con acento de mariposa */}
        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={guardando}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#e05a1b] to-[#ea580c] hover:from-[#c2410c] hover:to-[#e05a1b] text-white text-xs font-semibold rounded-xl shadow-md shadow-orange-500/20 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4 text-white" />
            <span>{guardando ? "Guardando cambios..." : "Guardar Configuración"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
