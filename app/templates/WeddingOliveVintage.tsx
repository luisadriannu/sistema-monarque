"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import {
  CalendarDays,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { Cormorant_Garamond, Libre_Baskerville } from "next/font/google";
import CountDown from "@/app/components/CountDown";
import type { EventData } from "@/app/types/EventData";
import { formatDateLongMx, formatDateMx } from "@/lib/utils";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-cy-display",
});
const utility = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-cy-utility",
});

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] },
} as const;

function Leaf({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 80 120"
      fill="none"
      aria-hidden="true"
      className="h-24 w-16 text-[#7C8261]"
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      <path
        d="M11 112C25 78 38 48 67 9"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M23 84C8 77 7 65 9 58c11 3 18 10 14 26ZM34 61c-11-12-7-24-2-30 9 7 12 16 2 30ZM48 40c-7-13-1-23 5-28 7 8 7 17-5 28ZM29 76c16 0 23-10 25-17-12-2-22 2-25 17ZM43 52c15 1 23-8 25-15-11-3-21 1-25 15Z"
        fill="currentColor"
        opacity=".72"
      />
    </svg>
  );
}

function SectionHeading({
  eyebrow,
  children,
}: {
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <div className="text-center">
      <p
        className="text-[10px] font-medium uppercase tracking-[0.34em] text-[#9A7837]"
        style={{ fontFamily: "var(--font-cy-utility)" }}
      >
        {eyebrow}
      </p>
      <h2 className="mt-3 text-4xl font-medium italic text-[#464B38] sm:text-5xl">
        {children}
      </h2>
      <p className="mt-3 text-lg text-[#9A7837]" aria-hidden="true">
        ❦
      </p>
    </div>
  );
}

interface InvitadoData {
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
}

export default function WeddingOliveVintage({
  data,
  invitado: initialInvitado,
  evento,
  token,
}: Props) {
  const reduceMotion = useReducedMotion();
  const nameParts = data.event.name.split(" & ");
  const groom = nameParts[0] ?? data.event.name;
  const bride = nameParts[1] ?? "";

  const [invitado, setInvitado] = useState(initialInvitado);

  useEffect(() => {
    if (invitado.estado === "pendiente") {
      fetch("/api/rsvp", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
        .then((r) => r.json())
        .then((r) => {
          if (r.ok && r.estado === "visto")
            setInvitado((p) => ({ ...p, estado: "visto" }));
        })
        .catch(() => {});
    }
  }, [token, invitado.estado]);

  const [pasesSeleccionados, setPasesSeleccionados] = useState<number>(() =>
    initialInvitado.pases_confirmados !== null
      ? initialInvitado.pases_confirmados
      : initialInvitado.pases_asignados,
  );
  const [ninosSeleccionados, setNinosSeleccionados] = useState<number>(
    () => initialInvitado.ninos_confirmados ?? 0,
  );
  const [enviando, setEnviando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  const maxPases = invitado.pases_asignados;
  const yaRespondio =
    invitado.estado === "confirmado" || invitado.estado === "declinado";

  const handleSubmit = async () => {
    if (evento.expirado) return;
    setEnviando(true);
    setErrorEnvio(null);
    setMensajeExito(null);
    try {
      const res = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          pases_confirmados: pasesSeleccionados,
          ninos_confirmados:
            maxPases >= 2 && pasesSeleccionados > 0 ? ninosSeleccionados : 0,
        }),
      });
      const resData = await res.json();
      if (!res.ok)
        throw new Error(
          resData.error || "Ocurrió un error al guardar tu respuesta.",
        );
      setInvitado(resData.invitado);
      setMensajeExito(resData.mensaje);
    } catch (err: unknown) {
      setErrorEnvio(
        err instanceof Error
          ? err.message
          : "Error al procesar tu confirmación.",
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <main
      className={`${display.variable} ${utility.variable} overflow-hidden bg-[#E9DEC8] text-[#454938] [background-image:radial-gradient(circle_at_15%_20%,rgba(111,83,39,.09),transparent_28%),radial-gradient(circle_at_85%_70%,rgba(111,83,39,.08),transparent_30%)]`}
      style={{ fontFamily: "var(--font-cy-display)" }}
    >
      {/* Hero */}
      <section className="relative flex min-h-[100svh] items-center justify-center bg-[#37402F] px-6 py-12 [background-image:repeating-linear-gradient(90deg,rgba(255,255,255,.018)_0,rgba(255,255,255,.018)_1px,transparent_1px,transparent_7px)]">
        <div className="absolute inset-3 border border-[#C9AB68]/45" />
        <div className="absolute inset-5 border border-[#C9AB68]/15" />
        <div className="absolute left-4 top-2 opacity-55">
          <Leaf />
        </div>
        <div className="absolute bottom-2 right-4 opacity-55">
          <Leaf flip />
        </div>
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex min-h-[82svh] w-full max-w-lg flex-col items-center justify-end overflow-hidden border-[9px] border-[#D7C7A8] px-7 pb-16 pt-32 text-center outline outline-1 outline-offset-4 outline-[#B49350]/65 shadow-[0_25px_70px_rgba(22,28,18,.32)]"
        >
          <Image
            src={data.media.coverImage}
            alt="Fotografía de portada"
            fill
            priority
            className="object-cover object-center sepia-[.35] saturate-[.8] contrast-[.92]"
            sizes="(max-width: 640px) calc(100vw - 40px), 512px"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#272B20]/95 via-[#463D2D]/25 to-[#6F5B39]/15" />
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#263020]/90 to-transparent" />
          <span
            className="absolute left-3 top-2 text-4xl text-[#E0C687]/80"
            aria-hidden="true"
          >
            ⌜
          </span>
          <span
            className="absolute right-3 top-2 text-4xl text-[#E0C687]/80"
            aria-hidden="true"
          >
            ⌝
          </span>
          <div className="relative mb-7 flex h-18 w-18 items-center justify-center rounded-full border-4 border-double border-[#B49350]/70 bg-[#EDE1C8]/95">
            <span className="text-2xl italic text-[#657052]">
              {groom[0]}
              <span className="mx-1 text-base text-[#B49350]">&</span>
              {bride[0]}
            </span>
          </div>
          <p
            className="relative text-[10px] font-semibold uppercase tracking-[0.38em] text-[#E0C687]"
            style={{ fontFamily: "var(--font-cy-utility)" }}
          >
            Celebración
          </p>
          <h1 className="relative mt-7 max-w-md text-[clamp(2.7rem,10vw,5rem)] font-medium leading-[.9] text-[#FFF9EE] [text-shadow:0_3px_24px_rgba(0,0,0,.45)]">
            <span className="block">{groom}</span>
            {bride && (
              <>
                <span className="my-4 block text-2xl italic text-[#E0C687]">
                  y
                </span>
                <span className="block">{bride}</span>
              </>
            )}
          </h1>
          <div className="relative my-7 h-px w-20 bg-[#E0C687]/70" />
          <p
            className="relative text-sm font-medium uppercase tracking-[0.22em] text-[#F5E9D0]"
            style={{ fontFamily: "var(--font-cy-utility)" }}
          >
            {formatDateLongMx(evento.fecha_evento)}
          </p>
        </motion.div>
      </section>

      {/* Galería polaroid */}
      <section className="relative h-[78svh] min-h-[620px] overflow-hidden bg-[#C9B994] [background-image:radial-gradient(rgba(87,66,36,.16)_1px,transparent_1px)] [background-size:9px_9px]">
        <motion.div
          {...reveal}
          className="absolute left-[7%] top-[7%] h-[64%] w-[66%] -rotate-3 bg-[#F4EBD9] p-2 pb-12 shadow-[0_18px_40px_rgba(52,43,27,.28)]"
        >
          <div className="relative h-full w-full overflow-hidden border border-[#8F7342]/35">
            <Image
              src={data.media.gallery[0]}
              alt="Fotografía de la pareja"
              fill
              className="object-cover sepia-[.5] saturate-[.75] contrast-[.92]"
              sizes="66vw"
            />
          </div>
          <p className="mt-2 text-center text-xl italic text-[#5A5544]">Un instante para recordar</p>
        </motion.div>
        <motion.div
          {...reveal}
          className="absolute bottom-[8%] right-[6%] h-[45%] w-[53%] rotate-3 bg-[#F4EBD9] p-2 pb-11 shadow-[0_18px_40px_rgba(52,43,27,.3)]"
        >
          <div className="relative h-full w-full overflow-hidden border border-[#8F7342]/35">
            <Image
              src={data.media.gallery[1]}
              alt="Fotografía de la pareja"
              fill
              className="object-cover sepia-[.48] saturate-[.72] contrast-[.9]"
              sizes="53vw"
            />
          </div>
          <p className="mt-2 text-center text-lg italic text-[#5A5544]">Para toda la vida</p>
        </motion.div>
        <div className="absolute right-[8%] top-[9%] text-center text-[#5A5544]">
          <p className="text-3xl">❦</p>
          <p className="mt-1 text-[8px] uppercase tracking-[0.22em]" style={{ fontFamily: "var(--font-cy-utility)" }}>Nuestra historia</p>
        </div>
      </section>

      {data.event.phrase && (
        <section className="relative px-7 py-24 text-center">
          <motion.div {...reveal} className="relative mx-auto max-w-xl">
            <span className="text-5xl leading-none text-[#B08D46]/50">"</span>
            <p className="mt-1 text-2xl italic leading-relaxed text-[#555A45] sm:text-3xl">
              {data.event.phrase}
            </p>
            <div className="mx-auto mt-9 h-px w-16 bg-[#B08D46]/55" />
            <p
              className="mt-5 text-[10px] uppercase tracking-[0.28em] text-[#7A8063]"
              style={{ fontFamily: "var(--font-cy-utility)" }}
            >
              {evento.anfitriones}
            </p>
          </motion.div>
        </section>
      )}

      {/* Segunda galería polaroid invertida */}
      {data.media.gallery.length >= 4 && (
        <section className="relative h-[68svh] min-h-[520px] overflow-hidden bg-[#DDD0B8] [background-image:radial-gradient(rgba(87,66,36,.12)_1px,transparent_1px)] [background-size:9px_9px]">
          <motion.div
            {...reveal}
            className="absolute right-[7%] top-[7%] h-[60%] w-[60%] rotate-2 bg-[#F4EBD9] p-2 pb-12 shadow-[0_18px_40px_rgba(52,43,27,.28)]"
          >
            <div className="relative h-full w-full overflow-hidden border border-[#8F7342]/35">
              <Image
                src={data.media.gallery[2]}
                alt="Fotografía de la pareja"
                fill
                className="object-cover sepia-[.45] saturate-[.78] contrast-[.92]"
                sizes="60vw"
              />
            </div>
            <p className="mt-2 text-center text-xl italic text-[#5A5544]">Nuestro amor eterno</p>
          </motion.div>
          <motion.div
            {...reveal}
            className="absolute bottom-[8%] left-[6%] h-[42%] w-[50%] -rotate-2 bg-[#F4EBD9] p-2 pb-11 shadow-[0_18px_40px_rgba(52,43,27,.3)]"
          >
            <div className="relative h-full w-full overflow-hidden border border-[#8F7342]/35">
              <Image
                src={data.media.gallery[3]}
                alt="Fotografía de la pareja"
                fill
                className="object-cover sepia-[.5] saturate-[.72] contrast-[.9]"
                sizes="50vw"
              />
            </div>
            <p className="mt-2 text-center text-lg italic text-[#5A5544]">Juntos para siempre</p>
          </motion.div>
          <div className="absolute left-[8%] top-[9%] text-center text-[#5A5544]">
            <p className="text-3xl">❦</p>
            <p className="mt-1 text-[8px] uppercase tracking-[0.22em]" style={{ fontFamily: "var(--font-cy-utility)" }}>Nuestra boda</p>
          </div>
        </section>
      )}

      {/* Detalles del evento */}
      <section className="bg-[#DED3BE] px-5 py-20">
        <motion.div {...reveal} className="mx-auto max-w-3xl">
          <SectionHeading eyebrow="Acompáñanos">La celebración</SectionHeading>
          <div className="mt-12 grid border-4 border-double border-[#A78340]/45 bg-[#F3E9D5] sm:grid-cols-3">
            <div className="flex min-h-40 flex-col items-center justify-center border-b border-[#A78340]/25 p-6 text-center sm:border-b-0 sm:border-r">
              <CalendarDays
                size={23}
                strokeWidth={1.25}
                className="text-[#687054]"
              />
              <p
                className="mt-4 text-[9px] uppercase tracking-[0.25em] text-[#9A7837]"
                style={{ fontFamily: "var(--font-cy-utility)" }}
              >
                Fecha
              </p>
              <p className="mt-2 text-xl">
                {formatDateLongMx(evento.fecha_evento)}
              </p>
            </div>
            <div className="flex min-h-40 flex-col items-center justify-center border-b border-[#A78340]/25 p-6 text-center sm:border-b-0 sm:border-r">
              <Clock size={23} strokeWidth={1.25} className="text-[#687054]" />
              <p
                className="mt-4 text-[9px] uppercase tracking-[0.25em] text-[#9A7837]"
                style={{ fontFamily: "var(--font-cy-utility)" }}
              >
                Hora
              </p>
              <p className="mt-2 text-xl">
                {data.event.startsAt ??
                  new Date(evento.fecha_evento).toLocaleTimeString("es-MX", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
              </p>
            </div>
            <div className="flex min-h-40 flex-col items-center justify-center p-6 text-center">
              <MapPin size={23} strokeWidth={1.25} className="text-[#687054]" />
              <p
                className="mt-4 text-[9px] uppercase tracking-[0.25em] text-[#9A7837]"
                style={{ fontFamily: "var(--font-cy-utility)" }}
              >
                Lugar
              </p>
              <p className="mt-2 text-xl leading-tight">
                {data.location.reception}
              </p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Mapa */}
      <section className="relative overflow-hidden bg-[#2C3326] py-28 px-5">
        {/* Foto de fondo desenfocada */}
        <div className="absolute inset-0">
          <Image
            src={data.media.coverImage}
            alt=""
            fill
            aria-hidden
            className="object-cover object-center opacity-20 blur-sm sepia-[.6] saturate-[.5]"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#2C3326]/80 via-[#2C3326]/60 to-[#2C3326]/90" />
        </div>

        <motion.div {...reveal} className="relative mx-auto max-w-2xl">

          {/* Encabezado */}
          <div className="mb-10 text-center">
            <p className="text-[10px] font-medium uppercase tracking-[0.38em] text-[#D2B777]" style={{ fontFamily: "var(--font-cy-utility)" }}>Cómo llegar</p>
            <h2 className="mt-3 text-4xl font-medium italic text-[#FFF9EE] sm:text-5xl">El lugar</h2>
            <p className="mt-3 text-lg text-[#D2B777]">❦</p>
          </div>

          {/* Pastilla de ubicación */}
          <div className="mb-6 flex items-center justify-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent to-[#C9AB68]/40" />
            <div className="flex items-center gap-2 rounded-full border border-[#C9AB68]/40 bg-[#37402F]/80 px-5 py-2 backdrop-blur-sm">
              <MapPin size={13} strokeWidth={1.5} className="text-[#D2B777]" />
              <span className="text-sm italic text-[#F5E9D0]">{data.location.reception}</span>
            </div>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent to-[#C9AB68]/40" />
          </div>

          {/* Mapa con forma de sobre / postal */}
          <div className="relative">
            {/* Sombra exterior difuminada */}
            <div className="absolute -inset-1 rounded-2xl bg-[#C9AB68]/20 blur-md" />

            {/* Marco dorado */}
            <div className="relative overflow-hidden rounded-2xl border-2 border-[#C9AB68]/60 shadow-[0_32px_80px_rgba(0,0,0,.55)]">

              {/* Franja superior decorativa */}
              <div className="flex h-8 items-center justify-between bg-[#37402F] px-4">
                <div className="flex gap-1.5">
                  {["#C9AB68","#9A7837","#687054"].map(c => (
                    <span key={c} className="h-2 w-2 rounded-full opacity-70" style={{ background: c }} />
                  ))}
                </div>
                <p className="text-[8px] uppercase tracking-[0.3em] text-[#C9AB68]/70" style={{ fontFamily: "var(--font-cy-utility)" }}>
                  {data.location.reception}
                </p>
                <div className="flex gap-1.5">
                  {["#687054","#9A7837","#C9AB68"].map(c => (
                    <span key={c} className="h-2 w-2 rounded-full opacity-70" style={{ background: c }} />
                  ))}
                </div>
              </div>

              {/* iframe */}
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d483680.5891845961!2d-99.19703368462967!3d18.719801575826544!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x85cef1665ac3fa17%3A0x85a88bedb3e9838f!2sFINCA%20SAN%20JOS%C3%89!5e0!3m2!1ses-419!2smx!4v1792553073980!5m2!1ses-419!2smx"
                width="100%"
                height="360"
                style={{ border: 0, display: "block", filter: "sepia(0.2) saturate(0.9)" }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Ubicación del evento"
              />

              {/* Franja inferior con botón */}
              <div className="flex items-center justify-between gap-4 bg-[#37402F] px-5 py-3">
                <div>
                  <p className="text-[8px] uppercase tracking-[0.25em] text-[#9A9E7A]" style={{ fontFamily: "var(--font-cy-utility)" }}>Fecha</p>
                  <p className="text-sm italic text-[#E0C687]">{formatDateLongMx(evento.fecha_evento)}</p>
                </div>
                <a
                  href="https://maps.google.com/?q=Finca+San+Jose"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#C9AB68]/50 bg-[#464B38] px-4 py-2 text-[8px] uppercase tracking-[0.22em] text-[#D2B777] transition-colors hover:bg-[#596146]"
                  style={{ fontFamily: "var(--font-cy-utility)" }}
                >
                  <MapPin size={10} strokeWidth={1.5} />
                  Ver en Maps
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Familia */}
      {data.family &&
        (data.family.groomParents || data.family.brideParents) && (
          <section className="relative px-6 py-24 before:absolute before:inset-4 before:border before:border-[#9A7837]/20">
            <motion.div {...reveal} className="mx-auto max-w-3xl">
              <SectionHeading eyebrow="Con la bendición de">
                Nuestros padres
              </SectionHeading>
              <div className="mt-12 grid gap-10 border-y-4 border-double border-[#9A7837]/35 py-12 text-center sm:grid-cols-2 sm:gap-0">
                {data.family.groomParents && (
                  <div className="px-6 sm:border-r sm:border-[#B08D46]/30">
                    <p
                      className="text-[9px] uppercase tracking-[0.28em] text-[#9A7837]"
                      style={{ fontFamily: "var(--font-cy-utility)" }}
                    >
                      Familia del novio
                    </p>
                    <p className="mt-6 text-2xl">
                      {data.family.groomParents.father}
                    </p>
                    <span className="my-3 block text-sm italic text-[#B08D46]">
                      y
                    </span>
                    <p className="text-2xl">
                      {data.family.groomParents.mother}
                    </p>
                  </div>
                )}
                {data.family.brideParents && (
                  <div className="border-t border-[#B08D46]/30 px-6 pt-10 sm:border-t-0 sm:pt-0">
                    <p
                      className="text-[9px] uppercase tracking-[0.28em] text-[#9A7837]"
                      style={{ fontFamily: "var(--font-cy-utility)" }}
                    >
                      Familia de la novia
                    </p>
                    <p className="mt-6 text-2xl">
                      {data.family.brideParents.father}
                    </p>
                    <span className="my-3 block text-sm italic text-[#B08D46]">
                      y
                    </span>
                    <p className="text-2xl">
                      {data.family.brideParents.mother}
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </section>
        )}

      {/* Countdown */}
      <section className="relative bg-[#3E4635] px-8 py-20 text-center text-[#F5F0E7] [background-image:radial-gradient(rgba(214,190,133,.08)_1px,transparent_1px)] [background-size:12px_12px]">
        <div className="absolute inset-4 border-4 border-double border-[#D2B777]/30" />
        <motion.div {...reveal} className="relative mx-auto max-w-xl">
          <p
            className="text-[10px] uppercase tracking-[0.34em] text-[#D2B777]"
            style={{ fontFamily: "var(--font-cy-utility)" }}
          >
            Cada vez falta menos
          </p>
          <h2 className="mt-3 text-4xl italic">Para nuestro gran día</h2>
          <div className="mt-8 border-y border-[#D2B777]/35 py-2">
            <CountDown data={data} />
          </div>
        </motion.div>
      </section>

      {/* Itinerario */}
      {data.event.itinerary && (
        <section className="px-5 py-24">
          <motion.div {...reveal} className="mx-auto max-w-2xl">
            <SectionHeading eyebrow="El orden del día">
              Nuestro programa
            </SectionHeading>
            <div className="mt-12 border-4 border-double border-[#B08D46]/35 bg-[#F2E8D3]/65 px-5 py-4 sm:px-8">
              {data.event.itinerary.map((item, index) => (
                <motion.div
                  key={`${item.hour}-${item.title}`}
                  initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  className="grid grid-cols-[5.5rem_1fr] gap-5 border-b border-[#B08D46]/20 py-6 last:border-b-0 sm:grid-cols-[8rem_1fr]"
                >
                  <p
                    className="pt-1 text-right text-[9px] font-semibold uppercase leading-relaxed tracking-[0.1em] text-[#987536]"
                    style={{ fontFamily: "var(--font-cy-utility)" }}
                  >
                    {item.hour}
                  </p>
                  <div className="border-l border-[#7C8261]/35 pl-5">
                    <h3 className="text-2xl font-medium text-[#464B38]">
                      {item.title}
                    </h3>
                    {item.description && (
                      <p className="mt-1 text-base italic text-[#777565]">
                        {item.description}
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>
      )}

      {/* RSVP */}
      <section className="relative bg-[#DED3BE] px-5 py-20">
        <div className="absolute inset-4 border border-[#9A7837]/20" />
        <motion.div {...reveal} className="relative mx-auto max-w-lg">
          <SectionHeading eyebrow="Confirmación de asistencia">
            Tu invitación
          </SectionHeading>

          <div className="mt-12 border-4 border-double border-[#A78340]/45 bg-[#F3E9D5] p-8 space-y-6">
            {/* Saludo */}
            <div className="text-center">
              <h3 className="text-3xl italic text-[#464B38]">
                ¡Hola, {invitado.nombre}!
              </h3>
              <p className="mt-2 text-base text-[#7A8063]">
                Tienes{" "}
                <strong className="text-[#464B38]">
                  {invitado.pases_asignados}{" "}
                  {invitado.pases_asignados === 1
                    ? "pase reservado"
                    : "pases reservados"}
                </strong>{" "}
                con mucho cariño.
              </p>
            </div>

            <div className="h-px bg-[#B08D46]/30" />

            {/* Feedback */}
            {mensajeExito && (
              <div className="p-4 bg-[#f0f4e8] border border-[#7C8261]/40 text-[#464B38] text-sm rounded flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#687054] shrink-0 mt-0.5" />
                <span>{mensajeExito}</span>
              </div>
            )}
            {errorEnvio && (
              <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorEnvio}</span>
              </div>
            )}
            {yaRespondio && !mensajeExito && (
              <div className="p-3 bg-[#EDE1C8] border border-[#B08D46]/30 rounded flex items-center justify-between text-sm">
                <span className="text-[#7A8063]">Respuesta actual:</span>
                <span
                  className={`font-semibold px-3 py-0.5 rounded-full text-xs ${invitado.estado === "confirmado" ? "bg-[#687054]/20 text-[#464B38]" : "bg-rose-100 text-rose-800"}`}
                >
                  {invitado.estado === "confirmado"
                    ? `${invitado.pases_confirmados} ${invitado.pases_confirmados === 1 ? "asistente" : "asistentes"}`
                    : "Declinado"}
                </span>
              </div>
            )}

            {!evento.expirado ? (
              <div className="space-y-5">
                {/* Contador adultos */}
                <div className="text-center space-y-3">
                  <p
                    className="text-[10px] uppercase tracking-[0.25em] text-[#9A7837]"
                    style={{ fontFamily: "var(--font-cy-utility)" }}
                  >
                    ¿Cuántas personas asistirán?
                  </p>
                  <div className="flex items-center justify-center gap-6">
                    <button
                      type="button"
                      onClick={() => {
                        const n = pasesSeleccionados - 1;
                        if (n >= 0) {
                          setPasesSeleccionados(n);
                          if (ninosSeleccionados > n) setNinosSeleccionados(n);
                        }
                      }}
                      disabled={pasesSeleccionados <= 0}
                      className="w-12 h-12 border border-[#B08D46]/50 bg-[#EDE1C8] text-[#464B38] text-xl font-bold disabled:opacity-30 hover:bg-[#E0D0B0] transition-colors active:scale-95"
                    >
                      −
                    </button>
                    <div className="w-20 text-center">
                      <span className="block text-5xl font-medium text-[#464B38]">
                        {pasesSeleccionados}
                      </span>
                      <span className="text-[9px] uppercase tracking-[0.2em] text-[#9A7837]">
                        de {maxPases} máx.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (pasesSeleccionados < maxPases)
                          setPasesSeleccionados(pasesSeleccionados + 1);
                      }}
                      disabled={pasesSeleccionados >= maxPases}
                      className="w-12 h-12 border border-[#B08D46]/50 bg-[#EDE1C8] text-[#464B38] text-xl font-bold disabled:opacity-30 hover:bg-[#E0D0B0] transition-colors active:scale-95"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-sm italic text-[#7A8063]">
                    {pasesSeleccionados === 0 ? (
                      <span className="text-rose-700">
                        Indicarás que no podrás asistir.
                      </span>
                    ) : (
                      <span className="text-[#687054]">
                        Confirmarás para {pasesSeleccionados}{" "}
                        {pasesSeleccionados === 1 ? "persona" : "personas"}.
                      </span>
                    )}
                  </p>
                </div>

                {/* Contador niños */}
                {maxPases >= 2 && pasesSeleccionados > 0 && (
                  <div className="text-center space-y-3 border-t border-[#B08D46]/20 pt-5">
                    <p
                      className="text-[10px] uppercase tracking-[0.25em] text-[#9A7837]"
                      style={{ fontFamily: "var(--font-cy-utility)" }}
                    >
                      ¿Cuántos son niños?
                    </p>
                    <p className="text-xs italic text-[#9A7837]">
                      ({evento.texto_edad_nino || "menores de 12 años"})
                    </p>
                    <div className="flex items-center justify-center gap-6">
                      <button
                        type="button"
                        onClick={() => {
                          if (ninosSeleccionados > 0)
                            setNinosSeleccionados(ninosSeleccionados - 1);
                        }}
                        disabled={ninosSeleccionados <= 0}
                        className="w-12 h-12 border border-[#B08D46]/50 bg-[#EDE1C8] text-[#464B38] text-xl font-bold disabled:opacity-30 hover:bg-[#E0D0B0] transition-colors active:scale-95"
                      >
                        −
                      </button>
                      <div className="w-20 text-center">
                        <span className="block text-5xl font-medium text-[#464B38]">
                          {ninosSeleccionados}
                        </span>
                        <span className="text-[9px] uppercase tracking-[0.2em] text-[#9A7837]">
                          de {pasesSeleccionados} máx.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (ninosSeleccionados < pasesSeleccionados)
                            setNinosSeleccionados(ninosSeleccionados + 1);
                        }}
                        disabled={ninosSeleccionados >= pasesSeleccionados}
                        className="w-12 h-12 border border-[#B08D46]/50 bg-[#EDE1C8] text-[#464B38] text-xl font-bold disabled:opacity-30 hover:bg-[#E0D0B0] transition-colors active:scale-95"
                      >
                        +
                      </button>
                    </div>
                    <p className="text-sm text-[#7A8063]">
                      <strong className="text-[#464B38]">
                        {pasesSeleccionados - ninosSeleccionados}{" "}
                        {pasesSeleccionados - ninosSeleccionados === 1
                          ? "adulto"
                          : "adultos"}
                      </strong>
                      <span className="mx-2 text-[#B08D46]">·</span>
                      <strong className="text-[#464B38]">
                        {ninosSeleccionados}{" "}
                        {ninosSeleccionados === 1 ? "niño" : "niños"}
                      </strong>
                    </p>
                  </div>
                )}

                {/* Botón confirmar */}
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={enviando}
                  className={`w-full py-4 text-[10px] font-bold uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-2 disabled:opacity-60 ${pasesSeleccionados === 0 ? "bg-[#6B3A3A] text-[#F5E9D0] hover:bg-[#5A2E2E]" : "bg-[#37402F] text-[#E0C687] hover:bg-[#464B38]"}`}
                  style={{ fontFamily: "var(--font-cy-utility)" }}
                >
                  {enviando ? (
                    <span className="inline-block w-4 h-4 border-2 border-[#E0C687]/30 border-t-[#E0C687] rounded-full animate-spin" />
                  ) : pasesSeleccionados === 0 ? (
                    <>
                      <XCircle className="w-4 h-4" />
                      <span>Confirmar que no podré asistir</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        {yaRespondio
                          ? "Actualizar mi asistencia"
                          : "Confirmar mi asistencia"}
                      </span>
                    </>
                  )}
                </button>

                <p
                  className="text-center text-[11px] text-[#9A7837]"
                  style={{ fontFamily: "var(--font-cy-utility)" }}
                >
                  Fecha límite:{" "}
                  <strong>{formatDateMx(evento.fecha_limite_rsvp)}</strong>
                </p>
              </div>
            ) : (
              <div className="text-center space-y-3 border-t border-[#B08D46]/20 pt-6">
                <Clock size={28} className="mx-auto text-[#9A7837]" />
                <p className="text-xl italic text-[#464B38]">Plazo concluido</p>
                <p className="text-sm text-[#7A8063] leading-relaxed">
                  La fecha límite para confirmar concluyó el{" "}
                  <strong>{formatDateMx(evento.fecha_limite_rsvp)}</strong>.
                  Comunícate directamente con los anfitriones.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative border-t-4 border-double border-[#9A7837]/35 bg-[#CDBD9C] px-6 py-16 text-center">
        <div className="mx-auto flex max-w-sm items-center justify-center gap-2">
          <Leaf />
          <div>
            <p className="text-4xl italic text-[#4F5842]">
              {groom[0]} & {bride[0]}
            </p>
            <p
              className="mt-3 text-[9px] uppercase tracking-[0.3em] text-[#987536]"
              style={{ fontFamily: "var(--font-cy-utility)" }}
            >
              {formatDateMx(evento.fecha_evento)}
            </p>
          </div>
          <Leaf flip />
        </div>
      </footer>
    </main>
  );
}
