"use client";
import AsyncButton from "@/components/AsyncButton";
import { isRsvpUnchanged } from "@/lib/rsvp-state";

import { CSSProperties, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  Heart,
  MapPin,
  Sparkles,
  XCircle,
} from "lucide-react";
import type { EventData } from "@/app/types/EventData";
import { formatDateLongMx, formatDateMx } from "@/lib/utils";
import InvitationQrPass from "@/components/InvitationQrPass";
import { genericInvitationTheme } from "@/lib/event-theme";

interface InvitadoData {
  pases_ingresados?: number;
  ultima_entrada_en?: string | null;
  nombre: string;
  pases_asignados: number;
  pases_confirmados: number | null;
  ninos_confirmados?: number;
  estado: string;
  ultima_respuesta_en: string | null;
}

interface EventoData {
  nombre: string;
  anfitriones: string;
  fecha_evento: string;
  lugar: string;
  fecha_limite_rsvp: string;
  texto_edad_nino?: string;
  expirado: boolean;
}

interface Props {
  data: EventData;
  invitado: InvitadoData;
  evento: EventoData;
  token: string;
  previewMode?: boolean;
  qrImage?: string | null;
  qrEnabled?: boolean;
}

const genericTheme = {
  ...genericInvitationTheme,
  ornament: "✦",
} as const;

function EventCountdown({ date }: { date: string }) {
  const [remaining, setRemaining] = useState({ days: 0, hours: 0, minutes: 0 });

  useEffect(() => {
    const update = () => {
      const difference = Math.max(0, new Date(date).getTime() - Date.now());
      setRemaining({
        days: Math.floor(difference / 86_400_000),
        hours: Math.floor((difference % 86_400_000) / 3_600_000),
        minutes: Math.floor((difference % 3_600_000) / 60_000),
      });
    };
    update();
    const interval = window.setInterval(update, 60_000);
    return () => window.clearInterval(interval);
  }, [date]);

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-4">
      {[
        [remaining.days, "Días"],
        [remaining.hours, "Horas"],
        [remaining.minutes, "Minutos"],
      ].map(([value, label]) => (
        <div key={label} className="rounded-2xl border border-[var(--secondary)] bg-[var(--surface)]/80 px-2 py-4 text-center shadow-sm">
          <span className="block font-serif text-3xl text-[var(--primary)] sm:text-4xl">
            {String(value).padStart(2, "0")}
          </span>
          <span className="mt-1 block text-[9px] font-bold uppercase tracking-[.2em] text-[var(--muted)]">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function WeddingPersonalized({
  data,
  invitado: initialInvitado,
  evento,
  token,
  previewMode = false,
  qrImage,
  qrEnabled = Boolean(qrImage),
}: Props) {
  const reduceMotion = useReducedMotion();
  const theme = genericTheme;
  const names = data.event.name.split(/\s+(?:&|y)\s+/i);
  const hasPair = names.length > 1 && Boolean(names[1]?.trim());
  const firstName = (names[0] || evento.anfitriones).trim().split(/\s+/)[0];
  const secondName = (names[1] || "").trim().split(/\s+/)[0];
  const singleTitle = (data.event.name || evento.anfitriones).trim();
  const [opened, setOpened] = useState(false);
  const [invitado, setInvitado] = useState(initialInvitado);
  const [pases, setPases] = useState(
    initialInvitado.pases_confirmados ?? initialInvitado.pases_asignados,
  );
  const [ninos, setNinos] = useState(initialInvitado.ninos_confirmados ?? 0);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  const style = {
    "--background": theme.background,
    "--surface": theme.surface,
    "--primary": theme.primary,
    "--secondary": theme.secondary,
    "--accent": theme.accent,
    "--ink": theme.ink,
    "--muted": theme.muted,
  } as CSSProperties;

  useEffect(() => {
    if (previewMode || invitado.estado !== "pendiente") return;
    fetch("/api/rsvp", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((response) => response.json())
      .then((result) => {
        if (result.ok && result.estado === "visto") {
          setInvitado((current) => ({ ...current, estado: "visto" }));
        }
      })
      .catch(() => {});
  }, [invitado.estado, previewMode, token]);

  useEffect(() => {
    if (opened) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [opened]);

  const responseUnchanged = isRsvpUnchanged(invitado, pases, ninos);

  const submitRsvp = async (pasesAConfirmar: number = pases) => {
    if (sending || isRsvpUnchanged(invitado, pasesAConfirmar, pasesAConfirmar > 0 ? ninos : 0)) return;
    if (previewMode || evento.expirado) return;
    setSending(true);
    setFeedback(null);
    setRequestError(null);
    try {
      const response = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          pases_confirmados: pasesAConfirmar,
          ninos_confirmados: pasesAConfirmar > 0 ? ninos : 0,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo guardar tu respuesta.");
      setInvitado(result.invitado);
      setPases(result.invitado.pases_confirmados ?? pasesAConfirmar);
      setNinos(result.invitado.ninos_confirmados ?? 0);
      setFeedback(result.mensaje);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "No se pudo guardar tu respuesta.");
    } finally {
      setSending(false);
    }
  };

  const reveal = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 24 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.2 },
        transition: { duration: 0.65 },
      };

  return (
    <div style={style} className="min-h-screen bg-[var(--background)] text-[var(--ink)]">
{opened && qrEnabled && !previewMode && invitado.estado !== "declinado" && (
  <a hidden={invitado.estado !== "confirmado" || !(invitado.pases_confirmados && invitado.pases_confirmados > 0)} href="#pase-qr" className="fixed bottom-5 right-5 z-40 rounded-full bg-[#183126] px-5 py-3 text-sm font-semibold text-white shadow-xl">Ver mi pase QR</a>
)}

      <AnimatePresence mode="wait">
        {!opened ? (
          <motion.main
            key="cover"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            className="fixed inset-0 z-50 flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[var(--primary)] px-5 py-10"
          >
            <div className="absolute inset-4 border border-[var(--accent)]/50 sm:inset-8" />
            <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full border border-[var(--accent)]/25" />
            <div className="absolute -bottom-28 -right-20 h-80 w-80 rounded-full border border-[var(--accent)]/25" />
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="relative w-full max-w-xl text-center text-white"
            >
              <p className="text-2xl text-[var(--accent)]">{theme.ornament}</p>
              <p className="mt-5 text-[10px] font-bold uppercase tracking-[.38em] text-white/65">
                Tenemos el honor de invitarte
              </p>
              <h1 className="mt-8 font-serif text-5xl leading-[.9] sm:text-7xl">
                {hasPair ? (
                  <>
                    {firstName}
                    <span className="my-3 block text-3xl italic text-[var(--accent)]">&</span>
                    {secondName}
                  </>
                ) : (
                  singleTitle
                )}
              </h1>
              <p className="mx-auto mt-8 w-fit border-y border-white/20 px-7 py-3 text-xs uppercase tracking-[.28em] text-white/80">
                {formatDateMx(evento.fecha_evento)}
              </p>
              <button
                type="button"
                onClick={() => setOpened(true)}
                className="mt-10 inline-flex items-center gap-2 rounded-full border border-[var(--accent)] bg-[var(--accent)] px-7 py-3 text-[11px] font-bold uppercase tracking-[.2em] text-[var(--primary)] transition hover:brightness-110"
              >
                <Heart className="h-4 w-4" />
                Abrir invitación
              </button>
            </motion.div>
          </motion.main>
        ) : (
          <motion.main key="invitation" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <section className="relative flex min-h-[88vh] items-center overflow-hidden px-5 py-24 text-center">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,var(--secondary),transparent_42%),radial-gradient(circle_at_bottom_right,var(--secondary),transparent_38%)] opacity-80" />
              <motion.div {...reveal} className="relative mx-auto max-w-3xl">
                <p className="text-3xl text-[var(--accent)]">{theme.ornament}</p>
                <p className="mt-5 text-[10px] font-bold uppercase tracking-[.35em] text-[var(--muted)]">
                  Una fecha para recordar
                </p>
                <h1 className="mt-6 font-serif text-6xl leading-none text-[var(--primary)] sm:text-8xl">
                  {hasPair ? (
                    <>
                      {firstName}{" "}
                      <span className="italic text-[var(--accent)]">&</span>{" "}
                      {secondName}
                    </>
                  ) : (
                    singleTitle
                  )}
                </h1>
                <p className="mx-auto mt-8 max-w-xl font-serif text-xl italic leading-relaxed text-[var(--muted)] sm:text-2xl">
                  “{data.event.phrase}”
                </p>
                <div className="mx-auto mt-10 max-w-md">
                  <EventCountdown date={evento.fecha_evento} />
                </div>
              </motion.div>
            </section>

            <section className="bg-[var(--surface)] px-5 py-20">
              <motion.div {...reveal} className="mx-auto max-w-4xl">
                <div className="text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[.3em] text-[var(--accent)]">Reserva la fecha</p>
                  <h2 className="mt-3 font-serif text-4xl text-[var(--primary)] sm:text-5xl">La celebración</h2>
                </div>
                <div className="mt-12 grid gap-4 md:grid-cols-3">
                  <Detail icon={CalendarDays} title="Fecha" value={formatDateLongMx(evento.fecha_evento)} />
                  <Detail icon={Clock3} title="Hora" value={data.event.startsAt || "Horario por confirmar"} />
                  <Detail icon={MapPin} title="Lugar" value={evento.lugar} />
                </div>
                {data.event.dressCode && (
                  <p className="mt-8 text-center text-sm text-[var(--muted)]">
                    Código de vestimenta: <strong className="text-[var(--primary)]">{data.event.dressCode}</strong>
                  </p>
                )}
              </motion.div>
            </section>

            {Boolean(data.event.itinerary?.length) && (
              <section className="px-5 py-20">
                <motion.div {...reveal} className="mx-auto max-w-2xl">
                  <div className="text-center">
                    <Sparkles className="mx-auto h-5 w-5 text-[var(--accent)]" />
                    <h2 className="mt-3 font-serif text-4xl text-[var(--primary)]">Nuestro programa</h2>
                  </div>
                  <div className="mt-10 space-y-3">
                    {data.event.itinerary?.map((item, index) => (
                      <div key={`${item.hour}-${item.title}`} className="flex gap-4 rounded-2xl border border-[var(--secondary)] bg-[var(--surface)] p-5 shadow-sm">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-xs font-bold text-white">
                          {index + 1}
                        </span>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">{item.hour}</p>
                          <h3 className="mt-1 font-serif text-xl text-[var(--primary)]">{item.title}</h3>
                          {item.description && <p className="mt-1 text-sm text-[var(--muted)]">{item.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </section>
            )}

            <section className="bg-[var(--primary)] px-5 py-20 text-white">
              <motion.div {...reveal} className="mx-auto max-w-xl">
                <div className="text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[.3em] text-[var(--accent)]">Confirmación de asistencia</p>
                  <h2 className="mt-3 font-serif text-4xl">Tu invitación</h2>
                  <p className="mt-5 font-serif text-2xl italic">¡Hola, {invitado.nombre}!</p>
                  <p className="mt-2 text-sm text-white/70">
                    Tienes <strong className="text-white">{invitado.pases_asignados} {invitado.pases_asignados === 1 ? "pase reservado" : "pases reservados"}</strong>.
                  </p>
                </div>

                {previewMode && (
                  <div className="mx-auto mt-6 flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[.16em]">
                    <Eye className="h-3.5 w-3.5" /> Vista previa · Sin cambios reales
                  </div>
                )}

                <div className="mt-8 space-y-5 rounded-3xl bg-[var(--surface)] p-6 text-[var(--ink)] shadow-2xl sm:p-8">
                  {feedback && <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{feedback}</div>}
                  {requestError && <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{requestError}</div>}

                  {!evento.expirado ? (
                    <>
                      <Counter
                        label="¿Cuántas personas asistirán?"
                        value={pases}
                        max={invitado.pases_asignados}
                        disabled={previewMode}
                        onChange={(value) => {
                          setPases(value);
                          if (ninos > value) setNinos(value);
                        }}
                      />
                      {invitado.pases_asignados >= 2 && pases > 0 && (
                        <Counter
                          label={`¿Cuántos son niños? (${evento.texto_edad_nino || "menores de 12 años"})`}
                          value={ninos}
                          max={pases}
                          disabled={previewMode}
                          onChange={setNinos}
                        />
                      )}
                      <AsyncButton
                        type="button"
                        onClick={() => submitRsvp()}
                        disabled={sending || previewMode || responseUnchanged}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-4 text-xs font-bold uppercase tracking-[.18em] text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
                       loading={sending} loadingText="Guardando respuesta…">
                        {previewMode ? <Eye className="h-4 w-4" /> : pases === 0 ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                        {previewMode ? "Formulario deshabilitado" : sending ? "Guardando…" : responseUnchanged ? (invitado.estado === "declinado" ? "Ya confirmaste que no asistirás" : "Asistencia confirmada") : pases === 0 ? "No podré asistir" : "Confirmar asistencia"}
                      </AsyncButton>
{pases > 0 && <AsyncButton type="button" onClick={() => submitRsvp(0)} disabled={isRsvpUnchanged(invitado, 0, 0) || sending || previewMode} loading={sending} loadingText="Guardando respuesta…" className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-800 transition hover:bg-rose-100 disabled:opacity-60"><XCircle className="h-4 w-4" />No podré asistir</AsyncButton>}

                      <p className="text-center text-[10px] text-[var(--muted)]">Fecha límite: {formatDateMx(evento.fecha_limite_rsvp)}</p>
                    </>
                  ) : (
                    <div className="text-center text-sm text-[var(--muted)]">
                      <Clock3 className="mx-auto mb-2 h-6 w-6 text-[var(--accent)]" />
                      El plazo de confirmación ha concluido.
                    </div>
                  )}
                </div>
              </motion.div>
            </section>

            {qrEnabled && !previewMode && invitado.estado !== "declinado" && (
  <InvitationQrPass confirmed={invitado.estado === "confirmado" && (invitado.pases_confirmados ?? 0) > 0} key={token} token={token} initialScanned={Boolean(!qrImage && (initialInvitado.pases_ingresados || initialInvitado.ultima_entrada_en))} image={qrImage ?? null} guestName={invitado.nombre} passes={invitado.pases_confirmados ?? invitado.pases_asignados} />
)}
<footer className="bg-[var(--background)] px-5 py-12 text-center">
              <p className="font-serif text-3xl text-[var(--primary)]">
                {hasPair ? (
                  <>
                    {firstName}{" "}
                    <span className="italic text-[var(--accent)]">&</span>{" "}
                    {secondName}
                  </>
                ) : (
                  singleTitle
                )}
              </p>
              <p className="mt-3 text-[9px] font-bold uppercase tracking-[.28em] text-[var(--muted)]">Monarque · Invitaciones Web</p>
            </footer>
          </motion.main>
        )}
      </AnimatePresence>
    </div>
  );
}

function Detail({ icon: Icon, title, value }: { icon: typeof CalendarDays; title: string; value: string }) {
  return (
    <div className="rounded-3xl border border-[var(--secondary)] bg-[var(--background)] p-6 text-center">
      <Icon className="mx-auto h-5 w-5 text-[var(--accent)]" />
      <p className="mt-4 text-[9px] font-bold uppercase tracking-[.22em] text-[var(--muted)]">{title}</p>
      <p className="mt-2 font-serif text-xl text-[var(--primary)]">{value}</p>
    </div>
  );
}

function Counter({
  label,
  value,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[var(--muted)]">{label}</p>
      <div className="mt-3 flex items-center justify-center gap-5">
        <button type="button" disabled={disabled || value <= 0} onClick={() => onChange(value - 1)} className="h-11 w-11 rounded-full border border-[var(--secondary)] text-xl text-[var(--primary)] disabled:opacity-30">−</button>
        <div className="w-16">
          <span className="block font-serif text-4xl text-[var(--primary)]">{value}</span>
          <span className="text-[9px] uppercase text-[var(--muted)]">de {max}</span>
        </div>
        <button type="button" disabled={disabled || value >= max} onClick={() => onChange(value + 1)} className="h-11 w-11 rounded-full border border-[var(--secondary)] text-xl text-[var(--primary)] disabled:opacity-30">+</button>
      </div>
    </div>
  );
}
