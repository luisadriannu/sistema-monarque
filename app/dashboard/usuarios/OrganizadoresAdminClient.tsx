"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Crown, LoaderCircle, Plus, QrCode, Trash2, X } from "lucide-react";

type Organizer = {
  id: string;
  nombre: string;
  qr_checkin_habilitado: boolean;
  usuarios: { id: string; nombre: string; email: string }[];
  _count: { usuarios: number };
};

const emptyForm = { nombre: "", negocio: "", email: "", password: "", qr_checkin_habilitado: false };

export default function OrganizadoresAdminClient() {
  const [items, setItems] = useState<Organizer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/organizadores", { cache: "no-store" });
    const data = await response.json();
    setItems(data.organizaciones || []);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const response = await fetch("/api/organizadores", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await response.json();
    setSaving(false);
    if (!response.ok) return setMessage(data.error || "No se pudo crear.");
    setMessage("Organizador creado correctamente."); setOpen(false); setForm(emptyForm); void load();
  }

  async function toggleQr(item: Organizer) {
    const owner = item.usuarios[0]; if (!owner) return;
    const response = await fetch(`/api/organizadores/${item.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre: owner.nombre, negocio: item.nombre, email: owner.email, qr_checkin_habilitado: !item.qr_checkin_habilitado }) });
    if (response.ok) { setMessage(!item.qr_checkin_habilitado ? "Acceso QR activado." : "Acceso QR desactivado."); void load(); }
  }

  async function remove(item: Organizer) {
    if (!window.confirm(`¿Eliminar ${item.nombre}? También se eliminarán sus clientes, eventos e invitados.`)) return;
    const response = await fetch(`/api/organizadores/${item.id}`, { method: "DELETE" });
    const data = await response.json(); setMessage(data.message || data.error); if (response.ok) void load();
  }

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-[.22em] text-[#e05a1b]">Red Monarque</p><h1 className="mt-2 font-serif text-4xl font-bold">Organizadores</h1><p className="mt-2 text-sm text-stone-500">Crea empresas organizadoras y controla el acceso prémium al registro con QR.</p></div>
      <button onClick={() => setOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2b211b] px-5 py-3 text-sm font-semibold text-white"><Plus className="h-4 w-4"/>Nuevo organizador</button>
    </div>
    {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}
    {loading ? <div className="flex justify-center py-20"><LoaderCircle className="h-8 w-8 animate-spin text-[#e05a1b]"/></div> :
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map(item => { const owner = item.usuarios[0]; return <article key={item.id} className="rounded-3xl border border-[#ebd9c4] bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-[#e05a1b]"><Building2/></div><button onClick={() => remove(item)} className="rounded-lg p-2 text-stone-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4"/></button></div>
        <h2 className="mt-4 font-serif text-xl font-bold">{item.nombre}</h2><p className="mt-1 text-sm text-stone-600">{owner?.nombre}</p><p className="text-xs text-stone-400">{owner?.email}</p>
        <button onClick={() => toggleQr(item)} className={`mt-5 flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left ${item.qr_checkin_habilitado ? "border-amber-300 bg-amber-50" : "border-stone-200 bg-stone-50"}`}><span className="flex items-center gap-2 text-sm font-semibold"><QrCode className="h-4 w-4"/>Control de acceso QR</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${item.qr_checkin_habilitado ? "bg-amber-500 text-white" : "bg-stone-200 text-stone-600"}`}>{item.qr_checkin_habilitado ? "PRÉMIUM" : "INACTIVO"}</span></button>
      </article>})}</div>}
    {open && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-950/55 p-4 backdrop-blur-sm"><form onSubmit={submit} className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-[#e05a1b]">Nueva cuenta</p><h2 className="font-serif text-2xl font-bold">Crear organizador</h2></div><button type="button" onClick={() => setOpen(false)}><X/></button></div><div className="mt-6 grid gap-4 sm:grid-cols-2">
      <label className="text-xs font-bold">Nombre<input required value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} className="mt-2 w-full rounded-xl border p-3 font-normal"/></label>
      <label className="text-xs font-bold">Empresa<input required value={form.negocio} onChange={e=>setForm({...form,negocio:e.target.value})} className="mt-2 w-full rounded-xl border p-3 font-normal"/></label>
      <label className="text-xs font-bold">Correo<input required type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="mt-2 w-full rounded-xl border p-3 font-normal"/></label>
      <label className="text-xs font-bold">Contraseña<input required minLength={8} type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} className="mt-2 w-full rounded-xl border p-3 font-normal"/></label>
    </div><label className="mt-5 flex cursor-pointer items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"><input type="checkbox" checked={form.qr_checkin_habilitado} onChange={e=>setForm({...form,qr_checkin_habilitado:e.target.checked})}/><Crown className="h-5 w-5 text-amber-600"/><span><strong className="block text-sm">Activar acceso QR prémium</strong><small className="text-stone-500">Habilita QR en invitaciones y escáner para este organizador.</small></span></label><button disabled={saving} className="mt-6 flex w-full justify-center rounded-xl bg-[#e05a1b] px-4 py-3 font-semibold text-white disabled:opacity-60">{saving ? <LoaderCircle className="animate-spin"/> : "Crear organizador"}</button></form></div>}
  </div>;
}
