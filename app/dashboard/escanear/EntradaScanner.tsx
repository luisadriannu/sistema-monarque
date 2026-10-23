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
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [guest, setGuest] = useState<Guest | null>(null);
  const [code, setCode] = useState("");
  const [amount, setAmount] = useState(1);
  const [message, setMessage] = useState("");
  const [logs, setLogs] = useState<Log[]>([]);
  const loadLogs = useCallback(async () => {
    const r = await fetch("/api/entradas", { cache: "no-store" });
    const d = await r.json();
    setLogs(d.registros || []);
  }, []);
  useEffect(() => {
    void loadLogs();
    return () => controls.current?.stop();
  }, [loadLogs]);
  async function lookup(raw: string) {
    controls.current?.stop();
    setScanning(false);
    setBusy(true);
    setMessage("");
    const normalized = raw.replace(/^monarque:entrada:/, "");
    const r = await fetch(
      `/api/entradas?codigo=${encodeURIComponent(normalized)}`,
    );
    const d = await r.json();
    setBusy(false);
    if (!r.ok) {
      setGuest(null);
      setMessage(d.error || "Código inválido.");
      return;
    }
    setCode(normalized);
    setGuest(d.invitado);
    setAmount(1);
  }
  async function start() {
    setGuest(null);
    setMessage("");
    setScanning(true);
    const reader = new BrowserQRCodeReader();
    try {
      controls.current = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current!,
        (result) => {
          if (result) void lookup(result.getText());
        },
      );
    } catch {
      setScanning(false);
      setMessage(
        "No se pudo abrir la cámara. Revisa el permiso del navegador.",
      );
    }
  }
  async function confirm() {
    if (!guest) return;
    setBusy(true);
    const r = await fetch("/api/entradas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo: code, cantidad: amount }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setMessage(d.error);
    setGuest(d.invitado);
    setMessage(
      `Entrada registrada: ${amount} ${amount === 1 ? "persona" : "personas"}.`,
    );
    void loadLogs();
  }
  const limit = guest ? (guest.pases_confirmados ?? guest.pases_asignados) : 0;
  const remaining = guest ? Math.max(0, limit - guest.pases_ingresados) : 0;
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[.22em] text-[#e05a1b]">
          Acceso prémium
        </p>
        <h1 className="mt-2 font-serif text-4xl font-bold">Escanear entrada</h1>
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
              {remaining > 0 ? (
                <>
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
