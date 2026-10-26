"use client";

import { useState } from "react";
import { Eye, EyeOff, KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";

export default function CuentaPage() {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (nueva !== confirmacion) return setMessage({ type: "error", text: "Las contraseñas nuevas no coinciden." });
    setSaving(true); setMessage(null);
    try {
      const response = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password_actual: actual, password_nueva: nueva }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo actualizar la contraseña.");
      setMessage({ type: "success", text: data.message });
      window.setTimeout(() => window.location.replace("/login"), 1200);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "No se pudo actualizar la contraseña." });
      setSaving(false);
    }
  }

  return <div className="mx-auto max-w-2xl space-y-6">
    <div><p className="text-xs font-bold uppercase tracking-[.22em] text-[#e05a1b]">Seguridad</p><h1 className="mt-2 font-serif text-4xl font-bold">Mi cuenta</h1><p className="mt-2 text-sm text-stone-500">Cambia tu contraseña y cierra automáticamente las sesiones anteriores.</p></div>
    <form onSubmit={submit} className="rounded-3xl border border-[#ebd9c4] bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-center gap-3 border-b border-stone-100 pb-5"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-[#e05a1b]"><KeyRound/></span><div><h2 className="font-serif text-2xl font-bold">Actualizar contraseña</h2><p className="text-xs text-stone-500">Utiliza al menos 10 caracteres.</p></div></div>
      <div className="mt-6 space-y-4">
        <PasswordField label="Contraseña actual" value={actual} onChange={setActual} show={show}/>
        <PasswordField label="Nueva contraseña" value={nueva} onChange={setNueva} show={show} minLength={10}/>
        <PasswordField label="Confirmar nueva contraseña" value={confirmacion} onChange={setConfirmacion} show={show} minLength={10}/>
        <button type="button" onClick={() => setShow(value => !value)} className="flex items-center gap-2 text-xs font-semibold text-stone-500">{show ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}{show ? "Ocultar contraseñas" : "Mostrar contraseñas"}</button>
      </div>
      {message && <div role="alert" className={`mt-5 rounded-xl p-3 text-sm ${message.type === "success" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}>{message.text}</div>}
      <button disabled={saving} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2b211b] px-4 py-3 font-semibold text-white disabled:opacity-60">{saving ? <LoaderCircle className="animate-spin"/> : <><ShieldCheck className="h-4 w-4"/>Guardar y cerrar sesiones</>}</button>
    </form>
  </div>;
}

function PasswordField({ label, value, onChange, show, minLength }: { label: string; value: string; onChange: (value: string) => void; show: boolean; minLength?: number }) {
  return <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">{label}<input required minLength={minLength} type={show ? "text" : "password"} value={value} onChange={event => onChange(event.target.value)} autoComplete={label === "Contraseña actual" ? "current-password" : "new-password"} className="mt-2 w-full rounded-xl border border-stone-200 px-4 py-3 text-base font-normal normal-case tracking-normal outline-none focus:border-[#e05a1b]"/></label>;
}
