"use client";
import AsyncButton from "@/components/AsyncButton";
import LoadingLink from "@/components/LoadingLink";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Edit3,
  ExternalLink,
  KeyRound,
  Mail,
  MapPin,
  LoaderCircle,
  Palette,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  X,
  Archive,
  RotateCcw,
} from "lucide-react";
import DashboardLoader from "@/components/DashboardLoader";
import EventTypeIcon from "@/components/EventTypeIcon";
import {
  formatDateMx,
  isEventFinished,
  toDateTimeInputValue,
} from "@/lib/utils";
import {
  eventTypeThemes,
  getEventTypeFromConfig,
  type EventType,
} from "@/lib/event-theme";

const eventTypeOptions = Object.keys(eventTypeThemes) as EventType[];

interface EventoCliente {
  id: string;
  nombre: string;
  anfitriones: string;
  slug: string;
  fecha_evento: string;
  lugar: string;
  capacidad_total: number | null;
  fecha_limite_rsvp: string;
  configuracion_invitacion?: {
    tipo?: string;
    system?: { eventType?: string };
  } | null;
  _count: { invitados: number };
}

interface UsuarioCliente {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  creado_en: string;
  eliminado_en: string | null;
  eventos: EventoCliente[];
}

interface FormState {
  nombre: string;
  email: string;
  password: string;
  eventoId: string;
  eventoNombre: string;
  anfitriones: string;
  slug: string;
  fechaEvento: string;
  lugar: string;
  tipoEvento: EventType;
}

const emptyForm: FormState = {
  nombre: "",
  email: "",
  password: "",
  eventoId: "",
  eventoNombre: "",
  anfitriones: "",
  slug: "",
  fechaEvento: "",
  lugar: "",
  tipoEvento: "boda",
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function eventDateToIso(value: string) {
  return new Date(`${value}:00-06:00`).toISOString();
}

export default function UsuariosAdminClient() {
  const [usuarios, setUsuarios] = useState<UsuarioCliente[]>([]);
  const [usuariosEliminados, setUsuariosEliminados] = useState<UsuarioCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [clienteEliminar, setClienteEliminar] =
    useState<UsuarioCliente | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadUsuarios = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch("/api/usuarios", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "No se pudieron cargar las cuentas.");
      setUsuarios(data.usuarios || []);
      setUsuariosEliminados(data.eliminados || []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudieron cargar las cuentas.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsuarios();
  }, [loadUsuarios]);

  useEffect(() => {
    if (!modalOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) setModalOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [modalOpen, saving]);

  useEffect(() => {
    if (!clienteEliminar) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deleting) setClienteEliminar(null);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [clienteEliminar, deleting]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (usuario: UsuarioCliente) => {
    const evento = usuario.eventos[0];
    if (!evento) {
      setError("Esta cuenta no tiene un evento asociado.");
      return;
    }
    setEditingId(usuario.id);
    setForm({
      nombre: usuario.nombre,
      email: usuario.email,
      password: "",
      eventoId: evento.id,
      eventoNombre: evento.nombre,
      anfitriones: evento.anfitriones,
      slug: evento.slug,
      fechaEvento: toDateTimeInputValue(evento.fecha_evento),
      lugar: evento.lugar,
      tipoEvento: getEventTypeFromConfig(evento.configuracion_invitacion),
    });
    setError(null);
    setModalOpen(true);
  };

  const openDelete = (usuario: UsuarioCliente) => {
    setDeleteError(null);
    setClienteEliminar(usuario);
  };

  const updateField = (field: keyof FormState, value: string) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "eventoNombre" && !editingId) next.slug = slugify(value);
      return next;
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        nombre: form.nombre,
        email: form.email,
        password: form.password,
        evento: {
          id: form.eventoId,
          nombre: form.eventoNombre,
          anfitriones: form.anfitriones,
          slug: form.slug,
          fecha_evento: eventDateToIso(form.fechaEvento),
          lugar: form.lugar,
          tipo_evento: form.tipoEvento,
        },
      };
      const response = await fetch(
        editingId ? `/api/usuarios/${editingId}` : "/api/usuarios",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "No se pudo guardar la cuenta.");

      setModalOpen(false);
      setSuccess(
        editingId
          ? "La cuenta se actualizó correctamente."
          : "La clienta y su evento se crearon correctamente.",
      );
      await loadUsuarios();
      setTimeout(() => setSuccess(null), 4500);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar la cuenta.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!clienteEliminar || deleting) return;

    setDeleting(true);
    setDeleteError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/usuarios/${clienteEliminar.id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "No se pudo eliminar la cuenta.");
      }

      const nombreEliminado = clienteEliminar.nombre;
      setUsuarios((current) =>
        current.filter((usuario) => usuario.id !== clienteEliminar.id),
      );
      setClienteEliminar(null);
      setSuccess(`La cuenta de ${nombreEliminado} se movió a la papelera y puede restaurarse.`);
      window.setTimeout(() => setSuccess(null), 4500);
    } catch (deleteRequestError) {
      setDeleteError(
        deleteRequestError instanceof Error
          ? deleteRequestError.message
          : "No se pudo eliminar la cuenta.",
      );
    } finally {
      setDeleting(false);
    }
  };

  const restoreClient = async (usuario: UsuarioCliente) => {
    const response = await fetch(`/api/usuarios/${usuario.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "restaurar" }) });
    const data = await response.json();
    if (!response.ok) return setError(data.error || "No se pudo restaurar la cuenta.");
    setSuccess(data.message); await loadUsuarios();
  };

  if (loading) {
    return (
      <DashboardLoader
        title="Cargando clientes"
        message="Consultando cuentas y eventos…"
        label="Cargando administración de clientes"
      />
    );
  }

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#e05a1b]">
            <ShieldCheck className="h-4 w-4" />
            Acceso administrativo
          </div>
          <h1 className="font-serif text-3xl font-bold text-[#2b211b] sm:text-4xl">
            Clientes
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-stone-500">
            Crea las cuentas de las anfitrionas y administra el evento asociado
            a cada una.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#e05a1b] px-5 py-3 text-xs font-bold text-white shadow-lg shadow-orange-500/20 transition-colors hover:bg-[#c94d14]"
        >
          <Plus className="h-4 w-4" />
          Nueva clienta
        </button>
      </header>

      {success && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          {success}
        </div>
      )}
      {error && !modalOpen && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        {usuarios.length === 0 ? (
          <div className="col-span-full rounded-3xl border border-dashed border-[#dfcbb5] bg-white p-12 text-center">
            <Users className="mx-auto h-10 w-10 text-[#d6ad83]" />
            <h2 className="mt-4 font-serif text-xl font-bold text-[#2b211b]">
              Aún no hay clientas
            </h2>
            <p className="mt-2 text-sm text-stone-500">
              Crea la primera cuenta junto con los datos de su evento.
            </p>
          </div>
        ) : (
          usuarios.map((usuario) => {
            const evento = usuario.eventos[0];
            const eventType = evento
              ? getEventTypeFromConfig(evento.configuracion_invitacion)
              : "boda";
            const eventTheme = eventTypeThemes[eventType];
            const eventoFinalizado = evento
              ? isEventFinished(evento.fecha_evento)
              : false;
            return (
              <article
                key={usuario.id}
                className="overflow-hidden rounded-3xl border border-[#eadbca] bg-white shadow-sm"
              >
                <div className="flex items-start justify-between gap-4 border-b border-[#f3e9de] p-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border"
                      style={{
                        backgroundColor: eventTheme.soft,
                        borderColor: eventTheme.softBorder,
                        color: eventTheme.accentStrong,
                      }}
                    >
                      <EventTypeIcon type={eventType} className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate font-serif text-lg font-bold text-[#2b211b]">
                        {usuario.nombre}
                      </h2>
                      <p className="flex items-center gap-1.5 truncate text-xs text-stone-500">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        {usuario.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEdit(usuario)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#eadbca] px-3 py-2 text-xs font-semibold text-stone-600 transition-colors hover:border-[#e05a1b] hover:text-[#e05a1b]"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => openDelete(usuario)}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 text-rose-500 transition-colors hover:bg-rose-50 hover:text-rose-700"
                      title={`Eliminar a ${usuario.nombre}`}
                      aria-label={`Eliminar a ${usuario.nombre}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {evento ? (
                  <div className="space-y-3 p-5 text-sm text-stone-600">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-[#2b211b]">
                        {evento.nombre}
                      </span>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <span
                          className="rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
                          style={{
                            backgroundColor: eventTheme.soft,
                            borderColor: eventTheme.softBorder,
                            color: eventTheme.accentStrong,
                          }}
                        >
                          <EventTypeIcon
                            type={eventType}
                            className="mr-1 inline-block h-3 w-3 align-[-2px]"
                          />
                          {eventTheme.label}
                        </span>
                        {eventoFinalizado && (
                          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-stone-600">
                            Finalizado
                          </span>
                        )}
                        <span className="rounded-full bg-[#f6efe7] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#9a653f]">
                          {evento._count.invitados} invitados
                        </span>
                      </div>
                    </div>
                    <p className="flex items-start gap-2">
                      <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-[#d65318]" />
                      {formatDateMx(evento.fecha_evento)}
                    </p>
                    <p className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#d65318]" />
                      {evento.lugar}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <LoadingLink
                        href={`/dashboard/invitados?evento_id=${evento.id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#2b211b] px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-[#49392f]"
                       loadingText="Cargando invitados…">
                        <Users className="h-3.5 w-3.5" />
                        Ver invitados
                      </LoadingLink>
                      <a
                        href={`/${evento.slug}?preview=1`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#d65318] hover:underline"
                      >
                        Vista previa
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                ) : (
                  <p className="p-5 text-sm text-rose-600">
                    Sin evento asociado.
                  </p>
                )}
              </article>
            );
          })
        )}
      </section>

      {usuariosEliminados.length > 0 && (
        <section className="rounded-3xl border border-dashed border-stone-300 bg-stone-50 p-5">
          <div className="flex items-center gap-2"><Archive className="h-5 w-5 text-stone-500"/><h2 className="font-serif text-xl font-bold">Clientes en papelera ({usuariosEliminados.length})</h2></div>
          <p className="mt-1 text-xs text-stone-500">Sus eventos e invitados permanecen intactos hasta que restaures la cuenta.</p>
          <div className="mt-4 space-y-2">{usuariosEliminados.map(usuario => <div key={usuario.id} className="flex flex-col gap-3 rounded-2xl bg-white p-4 sm:flex-row sm:items-center sm:justify-between"><div><strong>{usuario.nombre}</strong><p className="text-xs text-stone-500">{usuario.email}</p></div><button onClick={() => restoreClient(usuario)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 px-4 py-2 text-xs font-bold text-emerald-700"><RotateCcw className="h-4 w-4"/>Restaurar</button></div>)}</div>
        </section>
      )}

      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !saving && setModalOpen(false)}
            className="fixed inset-0 z-[100] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-stone-950/55 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              onClick={(event) => event.stopPropagation()}
              className="relative my-auto w-full max-w-3xl rounded-3xl border border-[#eadbca] bg-white shadow-2xl"
            >
              <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-3xl border-b border-[#f0e4d8] bg-white px-6 py-5">
                <div>
                  <h2 className="font-serif text-2xl font-bold text-[#2b211b]">
                    {editingId ? "Editar clienta" : "Nueva clienta"}
                  </h2>
                  <p className="mt-1 text-xs text-stone-500">
                    {editingId
                      ? "Deja la contraseña vacía para conservar la actual."
                      : "La cuenta y el evento se crearán al mismo tiempo."}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setModalOpen(false)}
                  className="rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form
                onSubmit={handleSubmit}
                className="max-h-[calc(100dvh-8rem)] overflow-y-auto p-6"
              >
                <fieldset disabled={saving} className="space-y-7">
                  <div>
                    <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#a04d24]">
                      <UserRound className="h-4 w-4" />
                      Acceso de la clienta
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Nombre" required>
                        <input
                          value={form.nombre}
                          onChange={(e) =>
                            updateField("nombre", e.target.value)
                          }
                          required
                          className={inputClass}
                        />
                      </Field>
                      <Field label="Correo electrónico" required>
                        <input
                          type="email"
                          value={form.email}
                          onChange={(e) => updateField("email", e.target.value)}
                          required
                          className={inputClass}
                        />
                      </Field>
                      <Field
                        label={
                          editingId
                            ? "Nueva contraseña (opcional)"
                            : "Contraseña temporal"
                        }
                        hint="Mínimo 10 caracteres"
                        required={!editingId}
                      >
                        <div className="relative">
                          <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                          <input
                            type="password"
                            minLength={10}
                            value={form.password}
                            onChange={(e) =>
                              updateField("password", e.target.value)
                            }
                            required={!editingId}
                            autoComplete="new-password"
                            className={`${inputClass} pl-10`}
                          />
                        </div>
                      </Field>
                    </div>
                  </div>

                  <div className="border-t border-[#f0e4d8] pt-6">
                    <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#a04d24]">
                      <CalendarDays className="h-4 w-4" />
                      Evento asignado
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Nombre del evento" required>
                        <input
                          value={form.eventoNombre}
                          onChange={(e) =>
                            updateField("eventoNombre", e.target.value)
                          }
                          placeholder="Boda Laura & Miguel"
                          required
                          className={inputClass}
                        />
                      </Field>
                      <Field label="Anfitriones" required>
                        <input
                          value={form.anfitriones}
                          onChange={(e) =>
                            updateField("anfitriones", e.target.value)
                          }
                          placeholder="Laura y Miguel"
                          required
                          className={inputClass}
                        />
                      </Field>
                      <Field
                        label="Enlace público"
                        hint={`/${form.slug || "nombre-del-evento"}`}
                        required
                      >
                        <input
                          value={form.slug}
                          onChange={(e) =>
                            updateField("slug", slugify(e.target.value))
                          }
                          required
                          pattern="[a-z0-9-]+"
                          className={inputClass}
                        />
                      </Field>
                      <Field label="Fecha y hora" required>
                        <input
                          type="datetime-local"
                          value={form.fechaEvento}
                          onChange={(e) =>
                            updateField("fechaEvento", e.target.value)
                          }
                          required
                          className={inputClass}
                        />
                      </Field>
                      <Field label="Lugar" required>
                        <input
                          value={form.lugar}
                          onChange={(e) => updateField("lugar", e.target.value)}
                          required
                          className={inputClass}
                        />
                      </Field>
                    </div>
                  </div>

                  <div className="border-t border-[#f0e4d8] pt-6">
                    <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#a04d24]">
                      <Palette className="h-4 w-4" />
                      Personalización del sistema
                    </h3>
                    <p className="mb-4 text-xs leading-relaxed text-stone-500">
                      El tipo de evento define los colores del panel de esta
                      clienta. La invitación pública usa una plantilla genérica
                      independiente que después puedes reemplazar manualmente.
                    </p>
                    <div className="grid gap-4">
                      <div>
                        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-stone-600">
                          Tipo de evento
                          <span className="ml-1 text-[#e05a1b]">*</span>
                        </p>
                        <div
                          role="radiogroup"
                          aria-label="Tipo de evento"
                          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                        >
                          {eventTypeOptions.map((type) => {
                            const option = eventTypeThemes[type];
                            const selected = form.tipoEvento === type;
                            return (
                              <button
                                key={type}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                onClick={() => updateField("tipoEvento", type)}
                                className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border px-3 py-4 text-center transition-all ${
                                  selected
                                    ? "shadow-md ring-2 ring-offset-1"
                                    : "bg-white text-stone-500 hover:-translate-y-0.5 hover:shadow-sm"
                                }`}
                                style={{
                                  backgroundColor: selected
                                    ? option.soft
                                    : undefined,
                                  borderColor: selected
                                    ? option.accent
                                    : option.softBorder,
                                  color: selected
                                    ? option.accentStrong
                                    : undefined,
                                  "--tw-ring-color": option.accent,
                                } as React.CSSProperties}
                              >
                                <EventTypeIcon
                                  type={type}
                                  className="h-7 w-7"
                                  strokeWidth={1.7}
                                />
                                <span className="text-[11px] font-bold">
                                  {option.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <SystemThemePreview eventType={form.tipoEvento} />
                    </div>
                  </div>
                </fieldset>

                {error && (
                  <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {error}
                  </div>
                )}

                <div className="mt-7 flex flex-col-reverse gap-3 border-t border-[#f0e4d8] pt-5 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setModalOpen(false)}
                    className="rounded-xl px-5 py-2.5 text-xs font-semibold text-stone-600 hover:bg-stone-100 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <AsyncButton
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#e05a1b] px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-orange-500/20 hover:bg-[#c94d14] disabled:opacity-60"
                   loadingText="Guardando…" loading={saving}>
                    {saving ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    {editingId ? "Guardar cambios" : "Crear cuenta y evento"}
                  </AsyncButton>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {clienteEliminar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => {
              if (!deleting) setClienteEliminar(null);
            }}
            className="fixed inset-0 z-[110] flex min-h-[100dvh] items-center justify-center bg-stone-950/60 p-4 backdrop-blur-sm"
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-client-title"
              aria-describedby="delete-client-description"
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              onClick={(event) => event.stopPropagation()}
              className="relative w-full max-w-md rounded-3xl border border-rose-100 bg-white p-6 shadow-2xl"
            >
              <button
                type="button"
                disabled={deleting}
                onClick={() => setClienteEliminar(null)}
                aria-label="Cerrar confirmación"
                className="absolute right-4 top-4 rounded-lg p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                <AlertTriangle className="h-7 w-7" />
              </div>
              <h2
                id="delete-client-title"
                className="mt-5 pr-8 font-serif text-2xl font-bold text-[#2b211b]"
              >
                ¿Mover a {clienteEliminar.nombre} a la papelera?
              </h2>
              <p
                id="delete-client-description"
                className="mt-2 text-sm leading-relaxed text-stone-600"
              >
                Se bloqueará su cuenta, pero se conservarán
                {clienteEliminar.eventos[0]
                  ? `, el evento “${clienteEliminar.eventos[0].nombre}”`
                  : ""}{" "}
                y sus registros asociados para poder restaurarlos.
              </p>

              <div className="mt-5 rounded-2xl border border-rose-100 bg-rose-50/70 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[.16em] text-rose-700">
                  Datos que se conservarán
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-rose-900">
                  <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">
                    1 cuenta
                  </span>
                  <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">
                    {clienteEliminar.eventos.length}{" "}
                    {clienteEliminar.eventos.length === 1
                      ? "evento"
                      : "eventos"}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">
                    {clienteEliminar.eventos.reduce(
                      (total, evento) => total + evento._count.invitados,
                      0,
                    )}{" "}
                    {clienteEliminar.eventos.reduce(
                      (total, evento) => total + evento._count.invitados,
                      0,
                    ) === 1
                      ? "invitado"
                      : "invitados"}
                  </span>
                </div>
              </div>

              {deleteError && (
                <div
                  role="alert"
                  className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700"
                >
                  {deleteError}
                </div>
              )}

              <p className="mt-4 text-xs font-semibold text-stone-500">
                Podrás restaurar la cuenta desde esta misma pantalla.
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setClienteEliminar(null)}
                  className="rounded-xl px-4 py-2.5 text-xs font-semibold text-stone-600 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancelar
                </button>
                <AsyncButton
                  type="button"
                  disabled={deleting}
                  onClick={handleDelete}
                  className="inline-flex min-w-36 items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-rose-500/20 transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-400"
                 loadingText="Moviendo…">
                  {deleting ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Moviendo…
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Mover a papelera
                    </>
                  )}
                </AsyncButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-[#e7d8c8] bg-[#fcfaf7] px-3.5 py-3 text-sm text-stone-800 outline-none transition focus:border-[#e05a1b] focus:ring-2 focus:ring-orange-100 disabled:opacity-60";

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wide text-stone-600">
        <span>
          {label}
          {required && <span className="ml-1 text-[#e05a1b]">*</span>}
        </span>
        {hint && (
          <span className="normal-case tracking-normal text-stone-400">
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}

function SystemThemePreview({ eventType }: { eventType: EventType }) {
  const palette = eventTypeThemes[eventType];
  return (
    <div
      className="overflow-hidden rounded-2xl border shadow-sm"
      style={{ borderColor: palette.softBorder }}
    >
      <div className="flex min-h-40 bg-white">
        <div
          className="hidden w-32 shrink-0 p-4 sm:block"
          style={{ backgroundColor: palette.ink }}
        >
          <div className="h-2 w-14 rounded-full bg-white/80" />
          <div className="mt-6 space-y-2">
            <div
              className="h-7 rounded-lg"
              style={{ backgroundColor: palette.accent }}
            />
            <div className="h-7 rounded-lg bg-white/10" />
            <div className="h-7 rounded-lg bg-white/10" />
          </div>
        </div>
        <div className="flex-1 p-5" style={{ backgroundColor: palette.soft }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p
                className="text-[9px] font-bold uppercase tracking-[.2em]"
                style={{ color: palette.accentStrong }}
              >
                Vista del panel
              </p>
              <p
                className="mt-1 flex items-center gap-2 font-serif text-xl"
                style={{ color: palette.ink }}
              >
                <EventTypeIcon type={eventType} className="h-5 w-5" />
                Evento · {palette.label}
              </p>
            </div>
            <div className="flex gap-1.5">
              {[palette.accent, palette.accentStrong, palette.softBorder].map(
                (color) => (
                  <span
                    key={color}
                    className="h-6 w-6 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: color }}
                  />
                ),
              )}
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {["Resumen", "Invitados", "Confirmados"].map((label, index) => (
              <div key={label} className="rounded-xl bg-white p-3 shadow-sm">
                <div
                  className="h-1.5 rounded-full"
                  style={{
                    backgroundColor:
                      index === 0 ? palette.accent : palette.softBorder,
                  }}
                />
                <p className="mt-2 truncate text-[8px] font-bold uppercase text-stone-400">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
