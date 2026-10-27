"use client";
import AsyncButton from "@/components/AsyncButton";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader, IScannerControls } from "@zxing/browser";
import {
  CheckCircle2,
  Camera,
  LoaderCircle,
  RefreshCw,
  Users,
  XCircle,
  CalendarDays,
  ShieldCheck,
  Search,
  Undo2,
  Wifi,
  WifiOff,
} from "lucide-react";

type EventOption = {
  id: string;
  nombre: string;
  anfitriones: string;
  fecha_evento: string;
  lugar: string;
  estado: string;
  recepcion_abre_en: string | null;
  recepcion_cierra_en: string | null;
  modo_ingreso: string;
};

type Guest = {
  id: string;
  nombre: string;
  grupo: string | null;
  pases_asignados: number;
  pases_confirmados: number | null;
  pases_ingresados: number;
  ultima_entrada_en: string | null;
  escaneado_en: string | null;
  estado: string;
  codigo_entrada: string;
  evento: {
    id: string;
    nombre: string;
    anfitriones: string;
    modo_ingreso: string;
  };
};
type Log = {
  id: string;
  cantidad: number;
  creado_en: string;
  invitado: { nombre: string; grupo: string | null };
  evento: { nombre: string };
};

export default function EntradaScanner({
  canManageReception,
}: {
  canManageReception: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controls = useRef<IScannerControls | null>(null);
  const processingScan = useRef(false);
  const confirmationLocked = useRef(false);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [guest, setGuest] = useState<Guest | null>(null);
  const [code, setCode] = useState("");
  const [amount, setAmount] = useState(1);
  const [message, setMessage] = useState("");
  const [entryResult, setEntryResult] = useState<"registered" | "review" | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const [attendees, setAttendees] = useState<
    (Guest & { ultima_entrada_en: string })[]
  >([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, total_pages: 1 });
  const [logsError, setLogsError] = useState("");
  const [logsLoading, setLogsLoading] = useState(false);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [changingReception, setChangingReception] = useState(false);
  const [manualSearch, setManualSearch] = useState("");
  const [manualResults, setManualResults] = useState<Guest[]>([]);
  const [searching, setSearching] = useState(false);
  const [online, setOnline] = useState(true);
  const loadLogs = useCallback(async () => {
    if (!selectedEventId) {
      setLogs([]);
      setAttendees([]);
      setPagination({ total: 0, total_pages: 1 });
      return;
    }
    setLogsLoading(true);
    try {
      const r = await fetch(
        `/api/entradas?evento_id=${encodeURIComponent(selectedEventId)}&page=${page}`,
        { cache: "no-store" },
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo cargar la asistencia.");
      setLogs(d.registros || []);
      setAttendees(d.asistentes || []);
      setPagination(d.pagination);
      setLogsError("");
    } catch (error) {
      setLogsError(
        error instanceof Error
          ? error.message
          : "No se pudo cargar la asistencia.",
      );
    } finally {
      setLogsLoading(false);
    }
  }, [page, selectedEventId]);
  useEffect(() => {
    async function loadEvents() {
      setEventsLoading(true);
      try {
        const response = await fetch("/api/entradas?catalogo=1", {
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "No se pudieron cargar los eventos.");
        const availableEvents = data.eventos || [];
        setEvents(availableEvents);
        if (availableEvents.length === 1)
          setSelectedEventId(availableEvents[0].id);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los eventos.",
        );
      } finally {
        setEventsLoading(false);
      }
    }
    void loadEvents();
  }, []);
  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);
  useEffect(() => () => controls.current?.stop(), []);
  useEffect(() => {
    setOnline(navigator.onLine);
    const connected = () => setOnline(true);
    const disconnected = () => setOnline(false);
    window.addEventListener("online", connected);
    window.addEventListener("offline", disconnected);
    return () => {
      window.removeEventListener("online", connected);
      window.removeEventListener("offline", disconnected);
    };
  }, []);
  async function lookup(raw: string) {
    controls.current?.stop();
    setScanning(false);
    setBusy(true);
    setMessage("");
    setGuest(null);
    setEntryResult(null);
    const normalized = raw.replace(/^monarque:entrada:/, "").trim();
    try {
      const r = await fetch(
        `/api/entradas?evento_id=${encodeURIComponent(selectedEventId)}&codigo=${encodeURIComponent(normalized)}`,
      );
      const d = await r.json();
      if (!r.ok) {
        setMessage(d.error || "Código inválido.");
        return;
      }
      setCode(normalized);
      setGuest(d.invitado);
      confirmationLocked.current = false;
      const guestLimit = d.invitado.pases_confirmados ?? d.invitado.pases_asignados;
      setAmount(Math.max(1, guestLimit - d.invitado.pases_ingresados));
    } catch {
      setMessage(
        "No se pudo consultar el pase. Revisa tu conexión e intenta nuevamente.",
      );
    } finally {
      setBusy(false);
      processingScan.current = false;
    }
  }
  async function start() {
    if (!selectedEventId) {
      setMessage(
        "Selecciona la fiesta que estás recibiendo antes de abrir la cámara.",
      );
      return;
    }
    if (selectedEvent?.estado !== "recepcion_abierta") {
      setMessage(
        "La recepción está cerrada. El organizador debe abrirla antes de escanear.",
      );
      return;
    }
    setGuest(null);
    setEntryResult(null);
    setMessage("");
    setScanning(true);
    processingScan.current = false;
    const reader = new BrowserQRCodeReader();
    try {
      const scannerControls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } }, audio: false },
        videoRef.current!,
        (result, _error, scanner) => {
          if (result && !processingScan.current) {
            processingScan.current = true;
            scanner.stop();
            void lookup(result.getText());
          }
        },
      );
      controls.current = scannerControls;
      if (processingScan.current) scannerControls.stop();
    } catch {
      setScanning(false);
      setMessage(
        "No se pudo abrir la cámara. Revisa el permiso del navegador.",
      );
    }
  }
  async function confirm() {
    if (!guest || busy || alreadyScanned || confirmationLocked.current) return;
    // Una selección permite un solo registro, incluso antes del siguiente render.
    // Solo una nueva consulta del QR o selección manual habilita otra llegada.
    confirmationLocked.current = true;
    setBusy(true);
    setMessage("");
    try {
    const r = await fetch("/api/entradas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo: code, invitado_id: guest.id, cantidad: amount, evento_id: selectedEventId }),
    });
    const d = await r.json();
    if (!r.ok) {
      setEntryResult("review");
      if (d.code === "ALREADY_SCANNED" && d.invitado) setGuest(d.invitado);
      if (d.code === "NOT_CONFIRMED") setGuest(null);
      return setMessage(d.error);
    }
    setGuest(d.invitado);
    setEntryResult("registered");
    setManualResults([]);
    setMessage(d.message || `Entrada registrada: ${amount} ${amount === 1 ? "persona" : "personas"}.`);
    void loadLogs();
    } catch {
      setEntryResult("review");
      setMessage("No se pudo verificar el resultado de la entrada. Vuelve a consultar el pase antes de registrar otra llegada.");
    } finally {
      setBusy(false);
    }
  }
  async function searchGuest(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedEventId || manualSearch.trim().length < 2) return;
    setSearching(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/entradas?evento_id=${encodeURIComponent(selectedEventId)}&buscar=${encodeURIComponent(manualSearch.trim())}`,
        { cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo buscar.");
      setManualResults(data.resultados || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo buscar.");
    } finally {
      setSearching(false);
    }
  }
  function chooseManualGuest(item: Guest) {
    if (busy) return;
    confirmationLocked.current = false;
    setEntryResult(null);
    setGuest(item); setCode(item.codigo_entrada); setAmount(1); setManualResults([]); setMessage("");
  }
  async function undoEntry(item: Guest) {
    if (
      !canManageReception ||
      !window.confirm(`¿Revertir la entrada de ${item.nombre}?`)
    )
      return;
    const response = await fetch(`/api/entradas/${item.id}`, {
      method: "DELETE",
    });
    const data = await response.json();
    setMessage(data.message || data.error);
    if (response.ok) {
      setGuest(null);
      void loadLogs();
    }
  }
  const limit = guest ? (guest.pases_confirmados ?? guest.pases_asignados) : 0;
  const alreadyScanned = Boolean(
    guest &&
    (guest.pases_ingresados >= limit ||
      (guest.evento.modo_ingreso === "unico" && guest.escaneado_en)),
  );
  const remaining =
    guest && !alreadyScanned ? Math.max(0, limit - guest.pases_ingresados) : 0;
  const selectedEvent = events.find((event) => event.id === selectedEventId);
  function changeEvent(eventId: string) {
    controls.current?.stop();
    setScanning(false);
    setSelectedEventId(eventId);
    setGuest(null);
    setCode("");
    setEntryResult(null);
    setMessage("");
    setPage(1);
  }
  async function changeReception(action: "abrir" | "cerrar") {
    if (!selectedEvent || changingReception) return;
    setChangingReception(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/eventos/${selectedEvent.id}/recepcion`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "No se pudo cambiar la recepción.");
      setEvents((items) =>
        items.map((item) =>
          item.id === selectedEvent.id ? { ...item, ...data.evento } : item,
        ),
      );
      setGuest(null);
      setMessage(data.message);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo cambiar la recepción.",
      );
    } finally {
      setChangingReception(false);
    }
  }
  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-[.22em] text-[#e05a1b]">
            Acceso prémium
          </p>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${online ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}
          >
            {online ? (
              <Wifi className="h-3.5 w-3.5" />
            ) : (
              <WifiOff className="h-3.5 w-3.5" />
            )}
            {online ? "Con conexión" : "Sin conexión"}
          </span>
        </div>
        <h1 className="mt-2 font-serif text-4xl font-bold">
          Escanear invitación
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          Valida el pase desde la invitación y registra cuántas personas
          ingresan.
        </p>
      </div>
      <section className="rounded-3xl border border-[#ebd9c4] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#e05a1b]">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-serif text-xl font-bold">
                Fiesta que estás recibiendo
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-stone-500">
                El escáner solamente aceptará códigos pertenecientes al evento
                seleccionado.
              </p>
            </div>
          </div>
          <label className="block w-full lg:max-w-md">
            <span className="sr-only">Seleccionar evento</span>
            <select
              value={selectedEventId}
              onChange={(event) => changeEvent(event.target.value)}
              disabled={eventsLoading || scanning || busy}
              className="w-full rounded-xl border border-[#dec0a2] bg-[#fffdf9] px-4 py-3 text-sm font-semibold text-stone-800 outline-none focus:border-[#e05a1b] focus:ring-2 focus:ring-orange-100 disabled:opacity-60"
            >
              <option value="">
                {eventsLoading ? "Cargando eventos…" : "Selecciona un evento"}
              </option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.nombre} ·{" "}
                  {new Date(event.fecha_evento).toLocaleDateString("es-MX", {
                    timeZone: "America/Mexico_City",
                  })}{" "}
                  ·{" "}
                  {event.estado === "recepcion_abierta" ? "Abierta" : "Cerrada"}
                </option>
              ))}
            </select>
          </label>
        </div>
        {selectedEvent && (
          <div
            className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${selectedEvent.estado === "recepcion_abierta" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}
          >
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
              <p>
                <strong>
                  {selectedEvent.estado === "recepcion_abierta"
                    ? "Recepción abierta:"
                    : "Recepción cerrada:"}
                </strong>{" "}
                {selectedEvent.estado === "recepcion_abierta"
                  ? `solo se registrarán invitados de ${selectedEvent.nombre}.`
                  : "no se aceptará ningún código hasta que el organizador la abra."}
              </p>
            </div>
            {canManageReception && (
              <button
                disabled={changingReception}
                onClick={() =>
                  changeReception(
                    selectedEvent.estado === "recepcion_abierta"
                      ? "cerrar"
                      : "abrir",
                  )
                }
                className={`mt-3 rounded-xl px-4 py-2 text-xs font-bold text-white disabled:opacity-50 ${selectedEvent.estado === "recepcion_abierta" ? "bg-rose-600" : "bg-emerald-700"}`}
              >
                {changingReception
                  ? "Actualizando…"
                  : selectedEvent.estado === "recepcion_abierta"
                    ? "Cerrar recepción"
                    : "Abrir recepción"}
              </button>
            )}
          </div>
        )}
      </section>
      <section className="rounded-3xl border border-[#ebd9c4] bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#e05a1b]">
            <Search className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-serif text-xl font-bold">
              Búsqueda manual de respaldo
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-stone-500">
              Úsala cuando la cámara no pueda leer el código. Solo muestra
              invitados confirmados del evento seleccionado.
            </p>
          </div>
        </div>
        <form
          onSubmit={searchGuest}
          className="mt-4 flex flex-col gap-2 sm:flex-row"
        >
          <input
            value={manualSearch}
            onChange={(event) => setManualSearch(event.target.value)}
            disabled={!selectedEventId || !online}
            minLength={2}
            placeholder="Nombre del invitado o familia"
            className="min-w-0 flex-1 rounded-xl border border-[#dec0a2] bg-[#fffdf9] px-4 py-3 text-sm outline-none focus:border-[#e05a1b] focus:ring-2 focus:ring-orange-100 disabled:opacity-50"
          />
          <button
            disabled={
              !selectedEventId ||
              !online ||
              searching ||
              manualSearch.trim().length < 2
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2b211b] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {searching ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}{" "}
            Buscar
          </button>
        </form>
        {!!manualResults.length && (
          <div className="mt-3 divide-y overflow-hidden rounded-2xl border border-stone-200">
            {manualResults.map((item) => {
              const itemLimit = item.pases_confirmados ?? item.pases_asignados;
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => chooseManualGuest(item)}
                  className="flex w-full items-center justify-between gap-3 bg-white px-4 py-3 text-left transition hover:bg-orange-50"
                >
                  <span>
                    <strong className="block text-sm">{item.nombre}</strong>
                    <span className="text-xs text-stone-500">
                      {item.grupo || "Sin grupo"}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-stone-600">
                    {item.pases_ingresados}/{itemLimit} ingresos
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {!online && (
          <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">
            La confirmación se detiene sin internet para evitar duplicados entre
            varios dispositivos. Cuando vuelva la conexión podrás continuar.
          </p>
        )}
      </section>
      <div className="grid gap-6 xl:grid-cols-[1fr_.9fr]">
        <section className="overflow-hidden rounded-3xl border border-[#ebd9c4] bg-white p-5 shadow-sm">
          <div className="aspect-square overflow-hidden rounded-2xl bg-stone-950">
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              muted
              playsInline
            />
          </div>
          <button
            onClick={start}
            disabled={
              !selectedEventId ||
              selectedEvent?.estado !== "recepcion_abierta" ||
              scanning ||
              busy
            }
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2b211b] px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            {scanning ? (
              <>
                <LoaderCircle className="animate-spin" />
                Buscando código…
              </>
            ) : (
              <>
                <Camera />
                {!selectedEventId
                  ? "Selecciona un evento"
                  : selectedEvent?.estado !== "recepcion_abierta"
                    ? "Recepción cerrada"
                    : "Abrir cámara"}
              </>
            )}
          </button>
        </section>
        <section className="rounded-3xl border border-[#ebd9c4] bg-white p-6 shadow-sm">
          {busy && !guest ? (
            <LoaderCircle className="mx-auto mt-20 animate-spin text-[#e05a1b]" />
          ) : guest ? (
            <>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-9 w-9 text-emerald-600" />
                <div>
                  <h2 className="font-serif text-2xl font-bold">
                    {guest.nombre}
                  </h2>
                  <p className="text-sm text-stone-500">
                    {guest.evento.nombre}
                  </p>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                <Stat value={limit} label="Permitidos" />
                <Stat value={guest.pases_ingresados} label="Ingresaron" />
                <Stat value={remaining} label="Disponibles" />
              </div>
              {entryResult ? (
                <div role="status" className="mt-6 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
                  <p className="font-bold">{entryResult === "registered" ? "Registro completado" : "Consulta el pase nuevamente"}</p>
                  <p className="mt-2">{entryResult === "registered"
                    ? remaining > 0
                      ? `Quedan ${remaining} pases disponibles. Para registrar otra llegada, vuelve a escanear el QR o busca y selecciona nuevamente al invitado.`
                      : "Ya no quedan pases disponibles para este QR. Puedes continuar con el siguiente invitado."
                    : "Antes de volver a confirmar, escanea el QR o busca y selecciona nuevamente al invitado para consultar sus ingresos actuales."}</p>
                  <button type="button" onClick={start} disabled={busy || scanning || !online || selectedEvent?.estado !== "recepcion_abierta"}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#2b211b] px-4 py-3 font-semibold text-white disabled:opacity-50">
                    <Camera className="h-4 w-4" /> Volver a escanear
                  </button>
                </div>
              ) : alreadyScanned ? (
                <div role="status" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-bold">Este código QR ya ha sido utilizado.</p>
                  <p className="mt-2">La entrada está registrada para {guest.pases_ingresados} {guest.pases_ingresados === 1 ? "persona" : "personas"}. Si se autorizaron pases adicionales, utiliza el nuevo QR generado en la invitación.</p>
                  {guest.ultima_entrada_en && <p className="mt-2 text-xs">Registrado el {new Date(guest.ultima_entrada_en).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}.</p>}
                </div>
              ) : guest.estado === "declinado" ? (
                <p className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
                  Este invitado declinó la invitación.
                </p>
              ) : guest.estado !== "confirmado" ||
                (guest.pases_confirmados ?? 0) < 1 ? (
                <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                  El invitado debe confirmar su asistencia antes de utilizar el
                  pase QR.
                </p>
              ) : remaining > 0 ? (
                <>
                  <p className="mt-5 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
                    {guest.evento.modo_ingreso === "parcial"
                      ? "Este evento permite entradas parciales. Puedes registrar ahora a una parte del grupo y usar el mismo QR después para los pases restantes."
                      : "Este QR se utiliza una sola vez. Selecciona todas las personas que ingresan antes de confirmar; no podrás agregar más ingresos con este código."}
                  </p>
                  <label className="mt-6 block text-xs font-bold uppercase tracking-wider">
                    Personas que ingresan ahora
                    <select
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      className="mt-2 w-full rounded-xl border p-3 text-base font-normal"
                    >
                      {Array.from({ length: remaining }, (_, i) => (
                        <option key={i + 1}>{i + 1}</option>
                      ))}
                    </select>
                  </label>
                  <AsyncButton
                    onClick={confirm}
                    disabled={busy || !online}
                    className="mt-4 flex w-full justify-center rounded-xl bg-emerald-600 p-3 font-semibold text-white"
                    loadingText="Registrando…"
                  >
                    {busy ? (
                      <LoaderCircle className="animate-spin" />
                    ) : (
                      "Confirmar entrada"
                    )}
                  </AsyncButton>
                </>
              ) : (
                <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                  Este pase ya fue utilizado por completo.
                </div>
              )}
            </>
          ) : (
            <div className="py-20 text-center text-stone-400">
              <Camera className="mx-auto h-12 w-12" />
              <p className="mt-3 text-sm">
                Escanea un QR para ver los datos del invitado.
              </p>
            </div>
          )}
          {message && (
            <div
              className={`mt-4 flex gap-2 rounded-xl p-3 text-sm ${message.startsWith("Entrada") || message.startsWith("Pases adicionales") ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}
            >
              {message.startsWith("Entrada") ||
              message.startsWith("Pases adicionales") ? (
                <CheckCircle2 />
              ) : (
                <XCircle />
              )}
              {message}
            </div>
          )}
        </section>
      </div>
      <section className="rounded-3xl border border-[#ebd9c4] bg-white p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-serif text-2xl font-bold">
            Asistencia registrada ({pagination.total})
          </h2>
          <AsyncButton
            loading={logsLoading}
            onClick={() => loadLogs()}
            aria-label="Actualizar asistencia"
            loadingText="Actualizando…"
          >
            <RefreshCw className="h-4 w-4" />
          </AsyncButton>
        </div>
        {logsError && (
          <p role="alert" className="mt-3 text-sm text-rose-700">
            {logsError}
          </p>
        )}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs text-stone-500">
              <tr>
                <th className="p-3">Invitado</th>
                <th className="p-3">Evento</th>
                <th className="p-3">Grupo</th>
                <th className="p-3">Ingresaron</th>
                <th className="p-3">Permitidos</th>
                <th className="p-3">Último ingreso</th>
                {canManageReception && <th className="p-3">Acción</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {attendees.map((attendee) => (
                <tr key={attendee.id}>
                  <td className="p-3 font-semibold">{attendee.nombre}</td>
                  <td className="p-3">{attendee.evento.nombre}</td>
                  <td className="p-3">{attendee.grupo || "—"}</td>
                  <td className="p-3">{attendee.pases_ingresados}</td>
                  <td className="p-3">
                    {attendee.pases_confirmados ?? attendee.pases_asignados}
                  </td>
                  <td className="whitespace-nowrap p-3">
                    {new Date(attendee.ultima_entrada_en).toLocaleString(
                      "es-MX",
                      { timeZone: "America/Mexico_City" },
                    )}
                  </td>
                  {canManageReception && (
                    <td className="p-3">
                      <button
                        onClick={() => undoEntry(attendee)}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50"
                      >
                        <Undo2 className="h-3.5 w-3.5" /> Revertir
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {!attendees.length && !logsError && (
            <p className="py-8 text-center text-sm text-stone-400">
              Aún no hay asistentes registrados. Escanea y confirma una entrada
              para registrarla.
            </p>
          )}
        </div>
        <div className="mt-4 flex items-center justify-end gap-4 text-sm">
          <button
            disabled={logsLoading || page <= 1}
            onClick={() => setPage((value) => value - 1)}
            className="disabled:opacity-40"
          >
            Anterior
          </button>
          <span>
            Página {page} de {pagination.total_pages}
          </span>
          <button
            disabled={logsLoading || page >= pagination.total_pages}
            onClick={() => setPage((value) => value + 1)}
            className="disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      </section>
      <section className="rounded-3xl border border-[#ebd9c4] bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-2xl font-bold">Ingresos recientes</h2>
          <AsyncButton
            loading={logsLoading}
            onClick={loadLogs}
            loadingText="Actualizando…"
          >
            <RefreshCw className="h-4 w-4" />
          </AsyncButton>
        </div>
        <div className="mt-4 divide-y">
          {logs.length ? (
            logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between py-3"
              >
                <div>
                  <p className="text-sm font-semibold">{log.invitado.nombre}</p>
                  <p className="text-xs text-stone-400">
                    {log.evento.nombre} ·{" "}
                    {new Date(log.creado_en).toLocaleString("es-MX")}
                  </p>
                </div>
                <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                  <Users className="h-3 w-3" />+{log.cantidad}
                </span>
              </div>
            ))
          ) : (
            <p className="py-8 text-center text-sm text-stone-400">
              Aún no hay entradas registradas.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl bg-stone-50 p-3">
      <strong className="block text-2xl">{value}</strong>
      <span className="text-[10px] uppercase text-stone-500">{label}</span>
    </div>
  );
}
