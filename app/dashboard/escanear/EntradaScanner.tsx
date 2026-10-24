"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader, IScannerControls } from "@zxing/browser";
import {
  CheckCircle2,
  Camera,
  LoaderCircle,
  RefreshCw,
  Users,
  XCircle,
} from "lucide-react";

type Guest = {
  id: string;
  nombre: string;
  grupo: string | null;
  pases_asignados: number;
  pases_confirmados: number | null;
  pases_ingresados: number;
  ultima_entrada_en: string | null;
  estado: string;
  evento: { nombre: string; anfitriones: string };
};
type Log = {
  id: string;
  cantidad: number;
  creado_en: string;
  invitado: { nombre: string; grupo: string | null };
  evento: { nombre: string };
};

export default function EntradaScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controls = useRef<IScannerControls | null>(null);
  const processingScan = useRef(false);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [guest, setGuest] = useState<Guest | null>(null);
  const [code, setCode] = useState("");
  const [amount, setAmount] = useState(1);
  const [message, setMessage] = useState("");
  const [logs, setLogs] = useState<Log[]>([]);
  const [attendees, setAttendees] = useState<(Guest & { ultima_entrada_en: string })[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, total_pages: 1 });
  const [logsError, setLogsError] = useState("");
  const loadLogs = useCallback(async () => {
    try {
      const r = await fetch(`/api/entradas?page=${page}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo cargar la asistencia.");
      setLogs(d.registros || []);
      setAttendees(d.asistentes || []);
      setPagination(d.pagination);
      setLogsError("");
    } catch (error) {
      setLogsError(error instanceof Error ? error.message : "No se pudo cargar la asistencia.");
    }
  }, [page]);
  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);
  useEffect(() => () => controls.current?.stop(), []);
  async function lookup(raw: string) {
    controls.current?.stop();
    setScanning(false);
    setBusy(true);
    setMessage("");
    setGuest(null);
    const normalized = raw.replace(/^monarque:entrada:/, "").trim();
    try {
      const r = await fetch(`/api/entradas?codigo=${encodeURIComponent(normalized)}`);
      const d = await r.json();
      if (!r.ok) {
        setMessage(d.error || "Código inválido.");
        return;
      }
      setCode(normalized);
      setGuest(d.invitado);
      setAmount(Math.max(1, d.invitado.pases_confirmados ?? d.invitado.pases_asignados));
    } catch {
      setMessage("No se pudo consultar el pase. Revisa tu conexión e intenta nuevamente.");
    } finally {
      setBusy(false);
      processingScan.current = false;
    }
  }
  async function start() {
    setGuest(null);
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
    if (!guest || busy || guest.pases_ingresados > 0 || guest.ultima_entrada_en) return;
    setBusy(true);
    setMessage("");
    try {
    const r = await fetch("/api/entradas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo: code, cantidad: amount }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) {
      if (d.code === "ALREADY_SCANNED" && d.invitado) setGuest(d.invitado);
      return setMessage(d.error);
    }
    setGuest(d.invitado);
    setMessage(
      `Entrada registrada: ${amount} ${amount === 1 ? "persona" : "personas"}.`,
    );
    void loadLogs();
    } catch {
      setMessage("No se pudo confirmar la entrada. Consulta el pase antes de reintentar.");
    } finally {
      setBusy(false);
    }
  }
  const limit = guest ? (guest.pases_confirmados ?? guest.pases_asignados) : 0;
  const alreadyScanned = Boolean(guest && (guest.pases_ingresados > 0 || guest.ultima_entrada_en));
  const remaining = guest && !alreadyScanned ? Math.max(0, limit - guest.pases_ingresados) : 0;
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[.22em] text-[#e05a1b]">
          Acceso prémium
        </p>
        <h1 className="mt-2 font-serif text-4xl font-bold">Escanear invitación</h1>
        <p className="mt-2 text-sm text-stone-500">
          Valida el pase desde la invitación y registra cuántas personas
          ingresan.
        </p>
      </div>
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
            disabled={scanning || busy}
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
                Abrir cámara
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
              {alreadyScanned ? (
                <div role="status" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-bold">Este código QR ya ha sido escaneado.</p>
                  <p className="mt-2">La entrada ya está registrada para {guest.pases_ingresados} {guest.pases_ingresados === 1 ? "persona" : "personas"}. No se puede volver a utilizar.</p>
                  {guest.ultima_entrada_en && <p className="mt-2 text-xs">Registrado el {new Date(guest.ultima_entrada_en).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}.</p>}
                </div>
              ) : guest.estado === "declinado" ? (
                <p className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">Este invitado declinó la invitación.</p>
              ) : remaining > 0 ? (
                <>
                  <p className="mt-5 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">Este QR se utiliza una sola vez. Selecciona todas las personas que ingresan antes de confirmar; no podrás agregar más ingresos con este código.</p>
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
                  <button
                    onClick={confirm}
                    disabled={busy}
                    className="mt-4 flex w-full justify-center rounded-xl bg-emerald-600 p-3 font-semibold text-white"
                  >
                    {busy ? (
                      <LoaderCircle className="animate-spin" />
                    ) : (
                      "Confirmar entrada"
                    )}
                  </button>
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
              className={`mt-4 flex gap-2 rounded-xl p-3 text-sm ${message.startsWith("Entrada") ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}
            >
              {message.startsWith("Entrada") ? <CheckCircle2 /> : <XCircle />}
              {message}
            </div>
          )}
        </section>
      </div>
      <section className="rounded-3xl border border-[#ebd9c4] bg-white p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-serif text-2xl font-bold">Asistencia registrada ({pagination.total})</h2>
          <button onClick={() => void loadLogs()} aria-label="Actualizar asistencia"><RefreshCw className="h-4 w-4" /></button>
        </div>
        {logsError && <p role="alert" className="mt-3 text-sm text-rose-700">{logsError}</p>}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs text-stone-500"><tr>
              <th className="p-3">Invitado</th><th className="p-3">Evento</th><th className="p-3">Grupo</th><th className="p-3">Ingresaron</th><th className="p-3">Permitidos</th><th className="p-3">Último ingreso</th>
            </tr></thead>
            <tbody className="divide-y">{attendees.map(attendee => <tr key={attendee.id}>
              <td className="p-3 font-semibold">{attendee.nombre}</td><td className="p-3">{attendee.evento.nombre}</td><td className="p-3">{attendee.grupo || "—"}</td><td className="p-3">{attendee.pases_ingresados}</td><td className="p-3">{attendee.pases_confirmados ?? attendee.pases_asignados}</td><td className="whitespace-nowrap p-3">{new Date(attendee.ultima_entrada_en).toLocaleString("es-MX", { timeZone: "America/Mexico_City" })}</td>
            </tr>)}</tbody>
          </table>
          {!attendees.length && !logsError && <p className="py-8 text-center text-sm text-stone-400">Aún no hay asistentes registrados. Escanea y confirma una entrada para registrarla.</p>}
        </div>
        <div className="mt-4 flex items-center justify-end gap-4 text-sm">
          <button disabled={page <= 1} onClick={() => setPage(value => value - 1)} className="disabled:opacity-40">Anterior</button>
          <span>Página {page} de {pagination.total_pages}</span>
          <button disabled={page >= pagination.total_pages} onClick={() => setPage(value => value + 1)} className="disabled:opacity-40">Siguiente</button>
        </div>
      </section>
      <section className="rounded-3xl border border-[#ebd9c4] bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-2xl font-bold">Ingresos recientes</h2>
          <button onClick={loadLogs}>
            <RefreshCw className="h-4 w-4" />
          </button>
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
