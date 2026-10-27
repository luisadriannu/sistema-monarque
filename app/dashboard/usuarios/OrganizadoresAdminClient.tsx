"use client";
import { lettersOnly, nameInputProps } from "@/lib/names";
import AsyncButton from "@/components/AsyncButton";

import { useCallback, useEffect, useState } from "react";
import { Archive, Building2, Crown, LoaderCircle, Pencil, Plus, QrCode, RotateCcw, Trash2, X } from "lucide-react";
import usePanelDialog from "@/components/usePanelDialog";

type Organizer = {
  id: string;
  nombre: string;
  qr_checkin_habilitado: boolean;
  plan: "basico" | "pro" | "elite";
  estado_servicio: "prueba" | "activo" | "suspendido" | "vencido";
  servicio_vence_en: string | null;
  max_clientes: number;
  max_eventos_activos: number;
  max_invitados_evento: number;
  eliminado_en: string | null;
  eliminar_despues_de: string | null;
  usuarios: { id: string; nombre: string; email: string }[];
  _count: { usuarios: number };
};

const emptyForm = { nombre: "", negocio: "", email: "", password: "", plan: "pro", estado_servicio: "activo", servicio_vence_en: "", qr_checkin_habilitado: true };

export default function OrganizadoresAdminClient() {
  const { confirmDialog, dialog } = usePanelDialog();
  const [deleting, setDeleting] = useState(false);
  const [items, setItems] = useState<Organizer[]>([]);
  const [deletedItems, setDeletedItems] = useState<Organizer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");
  const [updatingQr, setUpdatingQr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/organizadores", { cache: "no-store" });
    const data = await response.json();
    setItems(data.organizaciones || []);
    setDeletedItems(data.eliminadas || []);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const response = await fetch(editingId ? `/api/organizadores/${editingId}` : "/api/organizadores", { method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo crear.");
      setMessage(editingId ? "Organizador actualizado correctamente." : "Organizador creado correctamente."); setOpen(false); setForm(emptyForm); setEditingId(null); await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo crear el organizador.");
    } finally { setSaving(false); }
  }

  async function toggleQr(item: Organizer) {
    if (updatingQr) return;
    setUpdatingQr(item.id);
    setMessage("");
    try {
      const response = await fetch(`/api/organizadores/${item.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qr_checkin_habilitado: !item.qr_checkin_habilitado }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo actualizar el acceso QR.");
      setItems(current => current.map(value => value.id === item.id ? { ...value, qr_checkin_habilitado: data.organizacion.qr_checkin_habilitado } : value));
      setMessage(data.organizacion.qr_checkin_habilitado ? "Acceso QR activado. El organizador lo verá al volver a su panel." : "Acceso QR desactivado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo actualizar el acceso QR.");
    } finally {
      setUpdatingQr(null);
    }
  }

  async function remove(item: Organizer) {
    if (deleting) return;
    setDeleting(true);
    try {
      if (!(await confirmDialog(`¿Mover ${item.nombre} a la papelera?\n\nSe bloquearán sus sesiones inmediatamente. Los clientes, eventos e invitados se conservarán durante 30 días.`))) return;
      const response = await fetch(`/api/organizadores/${item.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo eliminar el organizador.");
      setMessage(data.message || "Organizador eliminado.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo eliminar el organizador.");
    } finally {
      setDeleting(false);
    }
  }

  function edit(item: Organizer) {
    const owner = item.usuarios[0];
    setEditingId(item.id);
    setForm({ nombre: owner?.nombre || "", negocio: item.nombre, email: owner?.email || "", password: "", plan: item.plan, estado_servicio: item.estado_servicio, servicio_vence_en: item.servicio_vence_en?.slice(0, 10) || "", qr_checkin_habilitado: item.qr_checkin_habilitado });
    setOpen(true);
  }

  async function restore(item: Organizer) {
    const response = await fetch(`/api/organizadores/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "restaurar" }) });
    const data = await response.json(); setMessage(data.message || data.error); if (response.ok) await load();
  }

  return <div className="space-y-6">
    {dialog}
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-[.22em] text-[#e05a1b]">Red Monarque</p><h1 className="mt-2 font-serif text-4xl font-bold">Organizadores</h1><p className="mt-2 text-sm text-stone-500">Crea empresas organizadoras y controla el acceso prémium al registro con QR.</p></div>
      <button onClick={() => setOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2b211b] px-5 py-3 text-sm font-semibold text-white"><Plus className="h-4 w-4"/>Nuevo organizador</button>
    </div>
    {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}
    {loading ? <div className="flex justify-center py-20"><LoaderCircle className="h-8 w-8 animate-spin text-[#e05a1b]"/></div> :
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map(item => { const owner = item.usuarios[0]; return <article key={item.id} className="rounded-3xl border border-[#ebd9c4] bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-[#e05a1b]"><Building2/></div><div className="flex"><button aria-label={`Editar ${item.nombre}`} onClick={() => edit(item)} className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700"><Pencil className="h-4 w-4"/></button><AsyncButton disabled={deleting} aria-label={`Eliminar ${item.nombre}`} onClick={() => remove(item)} className="rounded-lg p-2 text-stone-400 hover:bg-rose-50 hover:text-rose-600" loadingText="Moviendo…"><Trash2 className="h-4 w-4"/></AsyncButton></div></div>
        <h2 className="mt-4 font-serif text-xl font-bold">{item.nombre}</h2><p className="mt-1 text-sm text-stone-600">{owner?.nombre}</p><p className="text-xs text-stone-400">{owner?.email}</p>
        <div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full bg-[#2b211b] px-2.5 py-1 text-[10px] font-bold uppercase text-white">{item.plan}</span><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${item.estado_servicio === "activo" || item.estado_servicio === "prueba" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700"}`}>{item.estado_servicio}</span></div><p className="mt-3 text-[11px] text-stone-500">Límites: {item.max_clientes} clientes · {item.max_eventos_activos} eventos · {item.max_invitados_evento} invitados/evento</p>
        <AsyncButton disabled={Boolean(updatingQr) || item.plan === "basico"} onClick={() => toggleQr(item)} className={`mt-4 flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left ${item.qr_checkin_habilitado ? "border-amber-300 bg-amber-50" : "border-stone-200 bg-stone-50"}`} loadingText="Actualizando…"><span className="flex items-center gap-2 text-sm font-semibold"><QrCode className="h-4 w-4"/>Control de acceso QR</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${item.qr_checkin_habilitado ? "bg-amber-500 text-white" : "bg-stone-200 text-stone-600"}`}>{item.qr_checkin_habilitado ? "ACTIVO" : item.plan === "basico" ? "NO INCLUIDO" : "INACTIVO"}</span></AsyncButton>
      </article>})}</div>}
    {deletedItems.length > 0 && <section className="rounded-3xl border border-dashed border-stone-300 bg-stone-50 p-5"><div className="flex items-center gap-2"><Archive className="h-5 w-5 text-stone-500"/><h2 className="font-serif text-xl font-bold">Papelera ({deletedItems.length})</h2></div><div className="mt-4 space-y-2">{deletedItems.map(item => <div key={item.id} className="flex flex-col gap-3 rounded-2xl bg-white p-4 sm:flex-row sm:items-center sm:justify-between"><div><strong>{item.nombre}</strong><p className="text-xs text-stone-500">Conservado hasta {item.eliminar_despues_de ? new Date(item.eliminar_despues_de).toLocaleDateString("es-MX") : "30 días"}</p></div><button onClick={() => restore(item)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 px-4 py-2 text-xs font-bold text-emerald-700"><RotateCcw className="h-4 w-4"/>Restaurar</button></div>)}</div></section>}
    {open && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-950/55 p-4 backdrop-blur-sm"><form onSubmit={submit} className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-[#e05a1b]">{editingId ? "Configuración comercial" : "Nueva cuenta"}</p><h2 className="font-serif text-2xl font-bold">{editingId ? "Editar organizador" : "Crear organizador"}</h2></div><button type="button" onClick={() => { setOpen(false); setEditingId(null); setForm(emptyForm); }}><X/></button></div><div className="mt-6 grid gap-4 sm:grid-cols-2">
      <label className="text-xs font-bold">Nombre<input {...nameInputProps} required value={form.nombre} onChange={e=>setForm({...form,nombre:lettersOnly(e.target.value)})} className="mt-2 w-full rounded-xl border p-3 font-normal"/></label>
      <label className="text-xs font-bold">Empresa<input required value={form.negocio} onChange={e=>setForm({...form,negocio:e.target.value})} className="mt-2 w-full rounded-xl border p-3 font-normal"/></label>
      <label className="text-xs font-bold">Correo<input required type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="mt-2 w-full rounded-xl border p-3 font-normal"/></label>
      <label className="text-xs font-bold">Contraseña {editingId && <span className="font-normal text-stone-400">(opcional)</span>}<input required={!editingId} minLength={10} type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} className="mt-2 w-full rounded-xl border p-3 font-normal"/></label>
      <label className="text-xs font-bold">Plan<select value={form.plan} onChange={e=>setForm({...form,plan:e.target.value,qr_checkin_habilitado:e.target.value !== "basico"})} className="mt-2 w-full rounded-xl border p-3 font-normal"><option value="basico">Básico</option><option value="pro">Pro</option><option value="elite">Elite</option></select></label>
      <label className="text-xs font-bold">Estado del servicio<select value={form.estado_servicio} onChange={e=>setForm({...form,estado_servicio:e.target.value})} className="mt-2 w-full rounded-xl border p-3 font-normal"><option value="prueba">Prueba</option><option value="activo">Activo</option><option value="suspendido">Suspendido</option><option value="vencido">Vencido</option></select></label>
      <label className="text-xs font-bold sm:col-span-2">Vencimiento de licencia<input type="date" value={form.servicio_vence_en} onChange={e=>setForm({...form,servicio_vence_en:e.target.value})} className="mt-2 w-full rounded-xl border p-3 font-normal"/></label>
    </div><label className={`mt-5 flex cursor-pointer items-center gap-3 rounded-2xl border p-4 ${form.plan === "basico" ? "border-stone-200 bg-stone-50 opacity-60" : "border-amber-200 bg-amber-50"}`}><input disabled={form.plan === "basico"} type="checkbox" checked={form.plan !== "basico" && form.qr_checkin_habilitado} onChange={e=>setForm({...form,qr_checkin_habilitado:e.target.checked})}/><Crown className="h-5 w-5 text-amber-600"/><span><strong className="block text-sm">Control de acceso QR</strong><small className="text-stone-500">Disponible en planes Pro y Elite.</small></span></label><AsyncButton disabled={saving} className="mt-6 flex w-full justify-center rounded-xl bg-[#e05a1b] px-4 py-3 font-semibold text-white disabled:opacity-60" loadingText="Guardando…" loading={saving} type="submit">{saving ? <LoaderCircle className="animate-spin"/> : editingId ? "Guardar cambios" : "Crear organizador"}</AsyncButton></form></div>}
  </div>;
}
