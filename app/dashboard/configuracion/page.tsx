"use client";

import { useState, useEffect } from "react";
import {
  Calendar,
  MessageSquare,
  Save,
  CheckCircle,
  AlertCircle,
  Users,
} from "lucide-react";
import {
  toDateInputValue,
  endOfDayMexicoDate,
  formatDateMx,
} from "@/lib/utils";
import DashboardLoader from "@/components/DashboardLoader";

interface EventoConfig {
  id: string;
  nombre: string;
  anfitriones: string;
  fecha_evento: string;
  lugar: string;
  capacidad_total?: number | null;
  fecha_limite_rsvp: string;
  texto_edad_nino?: string;
  plantilla_mensaje: string;
  slug: string;
}

export default function ConfiguracionPage() {
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

  useEffect(() => {
    async function loadEvento() {
      try {
        const res = await fetch("/api/eventos");
        const data = await res.json();
        if (res.ok && data.eventos?.[0]) {
          const ev = data.eventos[0];
          setEvento(ev);
          setCapacidadTotal(
            ev.capacidad_total !== null && ev.capacidad_total !== undefined
              ? String(ev.capacidad_total)
              : ""
          );
          setTextoEdadNino(ev.texto_edad_nino || "menores de 12 años");
          setFechaLimiteRsvp(toDateInputValue(ev.fecha_limite_rsvp));
          setPlantillaMensaje(
            ev.plantilla_mensaje ||
              "¡Hola {nombre}! Te invitamos con mucho cariño a nuestro evento. Tienes {pases} pases reservados. Por favor confírmanos tu asistencia aquí: {link}"
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
          capacidad_total: capacidadTotal.trim() ? parseInt(capacidadTotal, 10) : null,
          fecha_limite_rsvp: fechaLimiteEndOfDay.toISOString(),
          texto_edad_nino: textoEdadNino.trim() || "menores de 12 años",
          plantilla_mensaje: plantillaMensaje,
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

  // Previsualización de texto con variables simuladas
  const previewMensaje = plantillaMensaje
    .replace(/{nombre}/g, "Familia Gómez Pérez")
    .replace(/{pases}/g, "4")
    .replace(/{fecha_limite}/g, formatDateMx(fechaLimiteRsvp))
    .replace(
      /{link}/g,
      `https://tudominio.com/${evento?.slug || "evento"}?id=x7k2p9qa`
    );

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
            Gestiona la fecha límite de confirmación, la capacidad de tu evento y el mensaje de invitación por WhatsApp
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
        {/* Parámetros de Asistencia y Capacidad */}
        <div className="bg-white border border-[#ebd9c4] rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-[#f5ede2]">
            <Calendar className="w-5 h-5 text-[#e05a1b]" />
            <h2 className="font-serif text-lg font-bold text-[#2b211b]">
              Control de Asistencia y Capacidad
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Fecha Límite de Confirmación */}
            <div className="bg-[#fbf8f4] p-5 rounded-2xl border border-[#ebd9c4] flex flex-col justify-between">
              <div>
                <label className="block text-xs font-bold text-stone-900 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Fecha Límite de Confirmación (RSVP)</span>
                  <span className="text-[10px] text-[#e05a1b] font-semibold lowercase">
                    cierre 23:59 hrs
                  </span>
                </label>
                <input
                  type="date"
                  required
                  value={fechaLimiteRsvp}
                  onChange={(e) => setFechaLimiteRsvp(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-[#dec0a2] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e05a1b]"
                />
              </div>
              <p className="text-[11px] text-stone-600 mt-3 leading-relaxed">
                Al concluir este día a las 23:59 hrs, el botón de confirmar se bloqueará automáticamente para los invitados. Si extiendes el plazo más adelante, solo cambia esta fecha y el sistema se reabrirá al instante.
              </p>
            </div>

            {/* Capacidad / Cupo Total del Evento */}
            <div className="bg-[#fbf8f4] p-5 rounded-2xl border border-[#ebd9c4] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-stone-900 uppercase tracking-wider">
                    Capacidad del Evento (Cupo de asientos)
                  </label>
                  <span className="text-[11px] text-[#e05a1b] font-semibold">
                    Opcional
                  </span>
                </div>
                <input
                  type="number"
                  min="1"
                  value={capacidadTotal}
                  onChange={(e) => setCapacidadTotal(e.target.value)}
                  placeholder="ej. 100"
                  className="w-full px-4 py-2.5 bg-white border border-[#dec0a2] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#e05a1b]"
                />
              </div>
              <p className="text-[11px] text-stone-600 mt-3 leading-relaxed">
                Si defines un cupo máximo, verás en tu Resumen una barra de control que te indica cuántos cupos te quedan disponibles (ej. &quot;71 de 100 cupos asignados • Te quedan 29 disponibles&quot;). Si lo dejas vacío, no se mostrará.
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
                Este texto aparecerá en la invitación cuando el invitado indique cuántos de sus asistentes son niños (ej. &quot;¿Cuántos de ellos son niños? (menores de 12 años)&quot;).
              </p>
            </div>
          </div>
        </div>

        {/* Plantilla de Mensaje para WhatsApp */}
        <div className="bg-white border border-[#ebd9c4] rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-[#f5ede2]">
            <MessageSquare className="w-5 h-5 text-[#e05a1b]" />
            <div>
              <h2 className="font-serif text-lg font-bold text-[#2b211b]">
                Mensaje de Invitación para WhatsApp
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
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
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider">
                Texto del Mensaje
              </label>
              <textarea
                rows={5}
                required
                value={plantillaMensaje}
                onChange={(e) => setPlantillaMensaje(e.target.value)}
                className="w-full p-3.5 bg-[#fbf8f4] border border-[#ebd9c4] rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-[#e05a1b] font-mono leading-relaxed"
              />
              <p className="text-[11px] text-stone-500">
                Este es el texto que se copiará y enviará a cada invitado junto con su enlace personalizado.
              </p>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider">
                Vista Previa en WhatsApp
              </label>
              <div className="bg-[#fbf8f4] p-4 rounded-2xl border border-[#ebd9c4] h-full flex flex-col justify-between">
                <p className="text-stone-800 whitespace-pre-wrap leading-relaxed text-[11px] font-sans">
                  {previewMensaje}
                </p>
                <span className="text-[10px] text-stone-400 font-medium block mt-3 pt-2 border-t border-stone-200/50">
                  Simulación con datos de ejemplo
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Botón de guardado */}
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
