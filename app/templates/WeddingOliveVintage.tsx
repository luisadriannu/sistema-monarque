"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  CalendarDays,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Heart,
  Camera,
  Wine,
  UtensilsCrossed,
  Music2,
  ChevronLeft,
  ChevronRight,
  Eye,
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

const vintageParticles = [
  [8, 16, 0], [17, 72, 1.1], [27, 35, 2.4], [39, 83, 0.7], [49, 19, 1.8],
  [58, 61, 3.1], [68, 29, 1.4], [77, 78, 2.7], [88, 42, 0.3], [94, 67, 2],
] as const;

function VintageParticles({ reduceMotion }: { reduceMotion: boolean | null }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {vintageParticles.map(([left, top, delay], index) => (
        <motion.span
          key={`${left}-${top}`}
          className="absolute h-1 w-1 rounded-full bg-[#F5E6B8] shadow-[0_0_10px_rgba(245,230,184,.8)]"
          style={{ left: `${left}%`, top: `${top}%` }}
          animate={reduceMotion ? undefined : { y: [0, -18, 0], x: [0, index % 2 ? 7 : -7, 0], opacity: [0.2, 0.85, 0.2], scale: [0.8, 1.5, 0.8] }}
          transition={{ duration: 5 + (index % 3), delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function FloralSpray({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/pictures/wedding/ivory-rose-spray.png"
      alt=""
      aria-hidden
      width={1024}
      height={1536}
      className={`pointer-events-none absolute object-contain ${className}`}
    />
  );
}

function VintageDivider() {
  return (
    <div className="relative z-10 flex items-center justify-center gap-4 py-5 text-[#A18142]" aria-hidden="true">
      <span className="h-px w-16 bg-gradient-to-r from-transparent to-current opacity-55 sm:w-28" />
      <span className="text-xl">❦</span>
      <span className="h-px w-16 bg-gradient-to-l from-transparent to-current opacity-55 sm:w-28" />
    </div>
  );
}

function WeddingRings() {
  return (
    <div className="relative h-14 w-24" aria-hidden="true">
      <span className="absolute left-2 top-3 h-11 w-11 -rotate-12 rounded-full border-2 border-[#DABF7C] shadow-[inset_0_0_0_2px_rgba(93,73,35,.28),0_3px_10px_rgba(0,0,0,.2)]" />
      <span className="absolute right-2 top-3 h-11 w-11 rotate-12 rounded-full border-2 border-[#E7CF91] shadow-[inset_0_0_0_2px_rgba(93,73,35,.28),0_3px_10px_rgba(0,0,0,.2)]" />
      <span className="absolute right-[1.15rem] top-1 h-4 w-4 rotate-45 border border-[#EAD9AB] bg-[#FFF8E8]/90 shadow-[0_0_12px_rgba(244,224,170,.65)]" />
      <span className="absolute right-[1.42rem] top-[.14rem] h-2.5 w-2.5 rotate-45 border border-white/80" />
    </div>
  );
}

function OpeningCover({
  groom,
  bride,
  date,
  image,
  onOpen,
  reduceMotion,
}: {
  groom: string;
  bride: string;
  date: string;
  image: string;
  onOpen: () => void;
  reduceMotion: boolean | null;
}) {
  const shortGroom = groom.trim().split(/\s+/)[0] || groom;
  const shortBride = bride.trim().split(/\s+/)[0] || bride;
  const openingNames = shortBride ? `${shortGroom} y ${shortBride}` : shortGroom;

  return (
    <motion.section
      key="opening-cover"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.035, filter: "blur(7px)" }}
      transition={{ duration: reduceMotion ? 0.15 : 0.75, ease: [0.22, 1, 0.36, 1] }}
      className={`${display.variable} ${utility.variable} fixed inset-0 z-[100] flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#293025] px-5 py-8 text-center`}
      style={{ fontFamily: "var(--font-cy-display)" }}
    >
      <Image src={image} alt="" fill priority className="object-cover opacity-30 sepia-[.45] saturate-[.65] scale-105" sizes="100vw" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(61,70,50,.38),rgba(25,30,22,.94)_72%)]" />
      <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(244,226,180,.18)_0.7px,transparent_0.7px)] [background-size:7px_7px]" />
      <VintageParticles reduceMotion={reduceMotion} />

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex min-h-[min(760px,90dvh)] w-full max-w-lg flex-col items-center justify-center px-3 py-10"
      >
        <Image src="/pictures/wedding/ivory-rose-corner.png" alt="" aria-hidden width={1300} height={1221} className="pointer-events-none absolute -left-28 -top-20 h-64 w-72 -rotate-6 object-contain opacity-75 drop-shadow-[0_12px_20px_rgba(0,0,0,.3)]" />
        <Image src="/pictures/wedding/ivory-rose-corner.png" alt="" aria-hidden width={1300} height={1221} className="pointer-events-none absolute -bottom-24 -right-28 h-72 w-80 rotate-[174deg] object-contain opacity-70 drop-shadow-[0_12px_20px_rgba(0,0,0,.3)]" />

        <p className="relative text-[9px] font-bold uppercase tracking-[0.5em] text-[#E5CE94]" style={{ fontFamily: "var(--font-cy-utility)" }}>
          Invitación de boda
        </p>
        <div className="relative my-5 flex items-center gap-4 text-[#D9BD79]">
          <span className="h-px w-16 bg-current opacity-45" />
          <WeddingRings />
          <span className="h-px w-16 bg-current opacity-45" />
        </div>
        <h1 className="relative max-w-md text-[clamp(3.15rem,14vw,5.5rem)] font-medium leading-[.88] text-[#FFF9EE] [text-shadow:0_5px_30px_rgba(0,0,0,.55)]">
          {openingNames}
        </h1>
        <p className="relative mt-7 text-[9px] font-bold uppercase tracking-[0.3em] text-[#F1DEAA]" style={{ fontFamily: "var(--font-cy-utility)" }}>
          {date}
        </p>

        <div className="relative mt-16 h-48 w-full max-w-sm drop-shadow-[0_25px_40px_rgba(0,0,0,.38)]">
          <div className="absolute inset-x-4 bottom-0 h-40 rounded-b-xl bg-[#D7C7A7]" />
          <div className="absolute inset-x-4 bottom-0 h-40 bg-[#E8DDC7] [clip-path:polygon(0_0,50%_58%,100%_0,100%_100%,0_100%)]" />
          <div className="absolute inset-x-4 top-0 h-32 bg-[#CDBB98] [clip-path:polygon(0_0,100%_0,50%_100%)]" />
          <div className="absolute left-8 right-8 top-[-2.25rem] h-28 border border-[#B69A61]/35 bg-[#F4EBDD] px-5 pt-5 shadow-md">
            <p className="text-[8px] font-bold uppercase tracking-[0.3em] text-[#94763C]" style={{ fontFamily: "var(--font-cy-utility)" }}>Con cariño para ti</p>
            <p className="mt-3 text-2xl italic text-[#4B5340]">{openingNames}</p>
          </div>
          <div className="absolute inset-x-0 top-[4.25rem] z-10 flex justify-center">
            <motion.button
              type="button"
              onClick={onOpen}
              whileHover={reduceMotion ? undefined : { scale: 1.035 }}
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              className="relative flex flex-col items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E6CD8D] focus-visible:ring-offset-4 focus-visible:ring-offset-[#293025]"
              aria-label="Abrir invitación"
            >
              <span className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-double border-[#D7BA72]/70 bg-[#4B573F] text-2xl italic text-[#F1DDA7] shadow-[0_10px_24px_rgba(0,0,0,.3)]">
                {groom[0]}<span className="mx-1 text-sm">&amp;</span>{bride[0]}
              </span>
              <span className="rounded-full border border-[#D5BD7E]/45 bg-[#263022]/90 px-6 py-2 text-[9px] font-bold uppercase tracking-[0.3em] text-[#F1DDA7] backdrop-blur-sm" style={{ fontFamily: "var(--font-cy-utility)" }}>
                Abrir invitación
              </span>
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.section>
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
  previewMode?: boolean;
}

export default function WeddingOliveVintage({
  data,
  invitado: initialInvitado,
  evento,
  token,
  previewMode = false,
}: Props) {
  const reduceMotion = useReducedMotion();
  const nameParts = data.event.name.split(" & ");
  const groom = nameParts[0] ?? data.event.name;
  const bride = nameParts[1] ?? "";
  const [opened, setOpened] = useState(false);
  const galleryPhotos = Array.from(new Set([data.media.coverImage, ...data.media.gallery]));
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryDirection, setGalleryDirection] = useState(1);

  const [invitado, setInvitado] = useState(initialInvitado);

  useEffect(() => {
    if (opened) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [opened]);

  useEffect(() => {
    if (previewMode) return;
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
  }, [token, invitado.estado, previewMode]);

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

  const changeGalleryPhoto = (direction: number) => {
    setGalleryDirection(direction);
    setGalleryIndex((current) =>
      (current + direction + galleryPhotos.length) % galleryPhotos.length
    );
  };

  const handleSubmit = async () => {
    if (evento.expirado || previewMode) return;
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
    <AnimatePresence mode="wait" initial={false}>
      {!opened ? (
        <OpeningCover
          key="opening"
          groom={groom}
          bride={bride}
          date={formatDateLongMx(evento.fecha_evento)}
          image={data.media.coverImage}
          reduceMotion={reduceMotion}
          onOpen={() => {
            window.scrollTo({ top: 0, behavior: "auto" });
            setOpened(true);
          }}
        />
      ) : (
    <motion.main
      key="invitation"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.65 }}
      className={`${display.variable} ${utility.variable} overflow-hidden bg-[#E9DEC8] text-[#454938] [background-image:radial-gradient(circle_at_15%_20%,rgba(111,83,39,.09),transparent_28%),radial-gradient(circle_at_85%_70%,rgba(111,83,39,.08),transparent_30%)]`}
      style={{ fontFamily: "var(--font-cy-display)" }}
    >
      {/* Hero */}
      <section className="relative flex min-h-[100svh] items-center justify-center bg-[#37402F] px-6 py-12 [background-image:repeating-linear-gradient(90deg,rgba(255,255,255,.018)_0,rgba(255,255,255,.018)_1px,transparent_1px,transparent_7px)]">
        <VintageParticles reduceMotion={reduceMotion} />
        <div className="absolute inset-3 border border-[#C9AB68]/45" />
        <div className="absolute inset-5 border border-[#C9AB68]/15" />
        <Image src="/pictures/wedding/ivory-rose-corner.png" alt="" aria-hidden width={1300} height={1221} className="pointer-events-none absolute -left-24 -top-20 h-64 w-72 -rotate-6 object-contain opacity-40" />
        <Image src="/pictures/wedding/ivory-rose-corner.png" alt="" aria-hidden width={1300} height={1221} className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-80 rotate-[174deg] object-contain opacity-35" />
        <div className="absolute left-4 top-2 opacity-55">
          <Leaf />
        </div>
        <div className="absolute bottom-2 right-4 opacity-55">
          <Leaf flip />
        </div>
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          className="relative min-h-[86svh] w-full max-w-2xl overflow-hidden rounded-t-[10rem] border-[7px] border-[#D7C7A8] text-center outline outline-1 outline-offset-4 outline-[#B49350]/65 shadow-[0_30px_90px_rgba(14,20,12,.45)] sm:rounded-t-[16rem]"
        >
          <Image
            src={data.media.coverImage}
            alt="Fotografía de portada"
            fill
            priority
            className="object-cover object-center sepia-[.32] saturate-[.78] contrast-[.94]"
            sizes="(max-width: 640px) calc(100vw - 40px), 672px"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#253020]/25 via-transparent to-[#1E271B]/80" />
          <div className="absolute inset-x-0 top-0 h-52 bg-gradient-to-b from-[#23301F]/65 to-transparent" />

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.8 }}
            className="absolute left-1/2 top-10 flex -translate-x-1/2 flex-col items-center"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[#F2DEAA]/65 bg-[#2F392A]/70 shadow-[0_12px_35px_rgba(0,0,0,.28)] backdrop-blur-sm">
              <span className="text-3xl italic text-[#F1DDA7]">
              {groom[0]}
                <span className="mx-1 text-base text-[#CBA85C]">&amp;</span>
              {bride[0]}
            </span>
            </div>
            <p className="mt-3 text-[8px] font-bold uppercase tracking-[0.42em] text-[#F2DEAA]" style={{ fontFamily: "var(--font-cy-utility)" }}>
              Save the date
            </p>
          </motion.div>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-x-5 bottom-7 border border-[#B69959]/55 bg-[#F3E9D8]/[.94] px-5 py-8 shadow-[0_24px_55px_rgba(17,23,14,.38)] backdrop-blur-[3px] before:absolute before:inset-2 before:border before:border-[#99814C]/25 sm:inset-x-10 sm:bottom-10 sm:px-10"
          >
            <Image src="/pictures/wedding/ivory-rose-corner.png" alt="" aria-hidden width={1300} height={1221} className="pointer-events-none absolute -left-14 -top-14 h-36 w-40 -rotate-6 object-contain drop-shadow-[0_8px_10px_rgba(54,60,43,.16)]" />
            <Image src="/pictures/wedding/ivory-rose-corner.png" alt="" aria-hidden width={1300} height={1221} className="pointer-events-none absolute -bottom-14 -right-14 h-36 w-40 rotate-[174deg] object-contain drop-shadow-[0_8px_10px_rgba(54,60,43,.16)]" />
            <p className="relative text-[9px] font-bold uppercase tracking-[0.38em] text-[#8B7139]" style={{ fontFamily: "var(--font-cy-utility)" }}>
              Nuestra historia continúa
            </p>
            <h1 className="relative mt-5 text-[clamp(3rem,11vw,5.5rem)] font-medium leading-[.78] text-[#3F4735]">
              <span className="block">{groom}</span>
              {bride && <span className="my-5 block text-2xl italic text-[#AA8743]">&amp;</span>}
              {bride && <span className="block">{bride}</span>}
            </h1>
            <div className="relative mx-auto my-6 flex max-w-[16rem] items-center gap-3 text-[#A38445]" aria-hidden="true">
              <span className="h-px flex-1 bg-current opacity-45" />
              <Heart className="h-4 w-4 fill-current" strokeWidth={1} />
              <span className="h-px flex-1 bg-current opacity-45" />
            </div>
            <p className="relative text-[10px] font-bold uppercase tracking-[0.2em] text-[#626A51]" style={{ fontFamily: "var(--font-cy-utility)" }}>
              {formatDateLongMx(evento.fecha_evento)}
            </p>
          </motion.div>
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
        <section className="relative overflow-hidden px-7 py-24 text-center">
          <FloralSpray className="-left-20 top-1/2 h-80 w-52 -translate-y-1/2 -rotate-6 opacity-25" />
          <FloralSpray className="-right-20 top-1/2 h-72 w-48 -translate-y-1/2 scale-x-[-1] rotate-6 opacity-20" />
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

      {/* Galería completa */}
      <section className="relative overflow-hidden bg-[#30382B] px-5 py-28 text-[#F7F0E2]">
        <div className="absolute inset-4 rounded-[3rem] border border-[#D2B777]/20" />
        <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(rgba(226,204,150,.22)_0.7px,transparent_0.7px)] [background-size:10px_10px]" />
        <motion.div {...reveal} className="relative mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-[9px] font-bold uppercase tracking-[0.42em] text-[#D2B777]" style={{ fontFamily: "var(--font-cy-utility)" }}>Nuestros recuerdos</p>
            <h2 className="mt-4 text-5xl font-medium italic sm:text-6xl">Galería</h2>
            <p className="mx-auto mt-4 max-w-md text-base italic text-[#C8C6B2]">Pequeños instantes de una historia que seguimos escribiendo juntos.</p>
          </div>

          <div className="relative mx-auto mt-12 max-w-4xl">
            <div className="absolute -inset-3 rounded-t-[9rem] rounded-b-[2.5rem] border border-[#D2B777]/35" />
            <div className="relative h-[62svh] min-h-[480px] max-h-[720px] overflow-hidden rounded-t-[8rem] rounded-b-[2rem] border-[6px] border-[#D8C69F] bg-[#171C15] shadow-[0_35px_90px_rgba(0,0,0,.5)] sm:h-[68svh]">
              <AnimatePresence initial={false} mode="popLayout" custom={galleryDirection}>
                <motion.div
                  key={galleryPhotos[galleryIndex]}
                  custom={galleryDirection}
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: galleryDirection > 0 ? 70 : -70, scale: 1.03 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: galleryDirection > 0 ? -70 : 70, scale: 0.98 }}
                  transition={{ duration: reduceMotion ? 0.15 : 0.55, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0"
                >
                  <Image
                    src={galleryPhotos[galleryIndex]}
                    alt={`Recuerdo de ${groom} y ${bride}, fotografía ${galleryIndex + 1}`}
                    fill
                    className="object-cover sepia-[.18] saturate-[.86] contrast-[.96]"
                    sizes="(max-width: 768px) 100vw, 896px"
                  />
                  <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#1D241A]/80 to-transparent" />
                </motion.div>
              </AnimatePresence>

              {galleryPhotos.length > 1 && (
                <>
                  <button type="button" onClick={() => changeGalleryPhoto(-1)} aria-label="Fotografía anterior" className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#E6D4A7]/55 bg-[#293226]/80 text-[#F4E4BA] shadow-lg backdrop-blur-sm transition-transform hover:scale-105 sm:left-5">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button type="button" onClick={() => changeGalleryPhoto(1)} aria-label="Fotografía siguiente" className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#E6D4A7]/55 bg-[#293226]/80 text-[#F4E4BA] shadow-lg backdrop-blur-sm transition-transform hover:scale-105 sm:right-5">
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}

              <div className="absolute bottom-5 left-1/2 z-10 -translate-x-1/2 rounded-full border border-[#E6D4A7]/35 bg-[#293226]/75 px-4 py-2 text-[9px] font-bold uppercase tracking-[0.25em] text-[#F1DDA7] backdrop-blur-sm" style={{ fontFamily: "var(--font-cy-utility)" }}>
                {String(galleryIndex + 1).padStart(2, "0")} / {String(galleryPhotos.length).padStart(2, "0")}
              </div>
            </div>
          </div>

          {galleryPhotos.length > 1 && (
            <div className="mx-auto mt-8 flex max-w-3xl gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none]">
              {galleryPhotos.map((photo, index) => (
                <button
                  type="button"
                  key={photo}
                  onClick={() => {
                    setGalleryDirection(index > galleryIndex ? 1 : -1);
                    setGalleryIndex(index);
                  }}
                  aria-label={`Ver fotografía ${index + 1}`}
                  aria-current={galleryIndex === index}
                  className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-[1rem] border-2 transition-all sm:h-20 sm:w-20 ${galleryIndex === index ? "scale-105 border-[#E0C687] opacity-100" : "border-transparent opacity-50 hover:opacity-80"}`}
                >
                  <Image src={photo} alt="" fill className="object-cover sepia-[.25]" sizes="80px" />
                </button>
              ))}
            </div>
          )}
        </motion.div>
      </section>

      {/* Detalles del evento */}
      <section className="relative overflow-hidden bg-[#DED3BE] px-5 py-20">
        <FloralSpray className="-right-24 top-8 h-96 w-64 rotate-6 opacity-30" />
        <motion.div {...reveal} className="relative mx-auto max-w-3xl">
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
          <VintageDivider />
        </motion.div>
      </section>

      {/* Mapa */}
      <section className="relative overflow-hidden bg-[#2C3326] px-5 py-28">
        <VintageParticles reduceMotion={reduceMotion} />
        <FloralSpray className="-left-28 bottom-0 h-[30rem] w-72 -rotate-6 opacity-[.12]" />
        <div className="absolute inset-0">
          <Image
            src={data.media.coverImage}
            alt=""
            fill
            aria-hidden
            className="object-cover object-center opacity-20 blur-sm sepia-[.6] saturate-[.5]"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#2C3326]/90 via-[#2C3326]/70 to-[#1F261C]/95" />
        </div>

        <motion.div {...reveal} className="relative mx-auto max-w-3xl">
          <div className="mb-12 text-center">
            <p className="text-[10px] font-medium uppercase tracking-[0.38em] text-[#D2B777]" style={{ fontFamily: "var(--font-cy-utility)" }}>Cómo llegar</p>
            <h2 className="mt-3 text-4xl font-medium italic text-[#FFF9EE] sm:text-5xl">El lugar</h2>
            <p className="mt-3 text-lg text-[#D2B777]">❦</p>
          </div>

          <div className="relative mx-auto max-w-xl">
            <div className="absolute -inset-x-3 -top-3 h-[466px] rounded-t-[16rem] rounded-b-[2.75rem] border border-[#D2B777]/30 sm:h-[526px]" />
            <div className="relative h-[460px] overflow-hidden rounded-t-[15rem] rounded-b-[2.25rem] border-[5px] border-[#D6C294] bg-[#D6C294] shadow-[0_38px_90px_rgba(0,0,0,.58)] sm:h-[520px]">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d483680.5891845961!2d-99.19703368462967!3d18.719801575826544!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x85cef1665ac3fa17%3A0x85a88bedb3e9838f!2sFINCA%20SAN%20JOS%C3%89!5e0!3m2!1ses-419!2smx!4v1792553073980!5m2!1ses-419!2smx"
                width="100%"
                height="100%"
                style={{ border: 0, display: "block", filter: "sepia(0.28) saturate(0.75) contrast(0.94)" }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Ubicación del evento"
              />
              <div className="pointer-events-none absolute left-1/2 top-7 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[#D2B777]/50 bg-[#30382B]/90 px-5 py-2 text-[#F5E9D0] shadow-lg backdrop-blur-sm">
                <MapPin size={13} strokeWidth={1.4} className="text-[#D2B777]" />
                <span className="whitespace-nowrap text-xs italic">Nuestra celebración</span>
              </div>
            </div>

            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="relative mx-auto mt-7 max-w-lg rounded-[1.5rem] border border-[#B99A58]/45 bg-[#F2E8D5] px-5 py-4 text-center text-[#414936] shadow-[0_18px_38px_rgba(10,15,9,.28)]"
            >
              <div className="flex flex-col items-center justify-between gap-4 sm:flex-row sm:text-left">
                <div>
                  <p className="text-[8px] font-bold uppercase tracking-[0.28em] text-[#9A7837]" style={{ fontFamily: "var(--font-cy-utility)" }}>Te esperamos en</p>
                  <h3 className="mt-1 text-xl font-medium italic">{data.location.reception}</h3>
                  <p className="mt-1 text-xs italic text-[#73765F]">{formatDateLongMx(evento.fecha_evento)}</p>
                </div>
                <a
                  href="https://maps.google.com/?q=Finca+San+Jose"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#3E4635] px-5 py-2.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[#E8D194] transition-transform hover:scale-[1.03]"
                  style={{ fontFamily: "var(--font-cy-utility)" }}
                >
                  <MapPin size={12} strokeWidth={1.5} /> Ver en Maps
                </a>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* Familia */}
      {data.family &&
        (data.family.groomParents || data.family.brideParents) && (
          <section className="relative overflow-hidden px-6 py-24 before:absolute before:inset-4 before:border before:border-[#9A7837]/20">
            <FloralSpray className="-right-24 top-1/2 h-[28rem] w-72 -translate-y-1/2 scale-x-[-1] opacity-25" />
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
      <section className="relative overflow-hidden bg-[#3E4635] px-8 py-20 text-center text-[#F5F0E7] [background-image:radial-gradient(rgba(214,190,133,.08)_1px,transparent_1px)] [background-size:12px_12px]">
        <VintageParticles reduceMotion={reduceMotion} />
        <FloralSpray className="-right-20 -top-20 h-80 w-52 rotate-12 opacity-[.16]" />
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
        <section className="relative overflow-hidden bg-[#E5D9C2] px-5 py-28">
          <div className="absolute inset-4 rounded-[2.5rem] border border-[#9A7837]/20" />
          <Image src="/pictures/wedding/ivory-rose-corner.png" alt="" aria-hidden width={1300} height={1221} className="pointer-events-none absolute -left-28 -top-16 h-72 w-80 -rotate-6 object-contain opacity-30" />
          <Image src="/pictures/wedding/ivory-rose-corner.png" alt="" aria-hidden width={1300} height={1221} className="pointer-events-none absolute -bottom-24 -right-28 h-80 w-96 rotate-[174deg] object-contain opacity-25" />
          <motion.div {...reveal} className="relative mx-auto max-w-4xl">
            <div className="text-center text-[#414936]">
              <p className="text-[9px] font-bold uppercase tracking-[0.42em] text-[#987536]" style={{ fontFamily: "var(--font-cy-utility)" }}>Momentos para compartir</p>
              <h2 className="mt-4 text-5xl font-medium italic sm:text-6xl">Nuestro programa</h2>
              <div className="mx-auto mt-5 flex max-w-44 items-center gap-3 text-[#A17F3F]" aria-hidden="true">
                <span className="h-px flex-1 bg-current opacity-40" /><span>❦</span><span className="h-px flex-1 bg-current opacity-40" />
              </div>
            </div>

            <div className="mt-14 grid gap-5 sm:grid-cols-2">
              {data.event.itinerary.map((item, index) => {
                const TimelineIcon = [Heart, Camera, Wine, UtensilsCrossed, Music2][index % 5];
                return (
                <motion.div
                  key={`${item.hour}-${item.title}`}
                  initial={reduceMotion ? false : { opacity: 0, y: 22, rotate: index % 2 ? 1 : -1 }}
                  whileInView={{ opacity: 1, y: 0, rotate: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ delay: index * 0.07, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  className={`relative overflow-hidden border border-[#B79554]/35 bg-[#F5EDDE] px-6 py-7 shadow-[0_16px_35px_rgba(73,62,40,.13)] ${index % 2 ? "rounded-[2rem_.5rem_2rem_2rem]" : "rounded-[.5rem_2rem_2rem_2rem]"}`}
                >
                  <span className="pointer-events-none absolute -right-1 -top-6 text-[7rem] font-medium leading-none text-[#B79554]/[.08]">{String(index + 1).padStart(2, "0")}</span>
                  <div className="relative flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#B79554]/45 bg-[#3E4635] text-[#E4CC8F] shadow-md">
                      <TimelineIcon className="h-5 w-5" strokeWidth={1.25} />
                    </div>
                    <div className="pt-1">
                      <p className="inline-flex rounded-full bg-[#E7D9BD] px-3 py-1 text-[9px] font-bold uppercase tracking-[0.2em] text-[#886C35]" style={{ fontFamily: "var(--font-cy-utility)" }}>{item.hour}</p>
                      <h3 className="mt-3 text-2xl font-medium italic text-[#414936]">{item.title}</h3>
                    </div>
                  </div>
                  {item.description && <p className="relative mt-5 border-t border-[#B79554]/20 pt-4 text-sm italic leading-relaxed text-[#777565]">{item.description}</p>}
                </motion.div>
                );
              })}
            </div>
          </motion.div>
        </section>
      )}

      {/* RSVP */}
      <section className="relative overflow-hidden bg-[#DED3BE] px-5 py-20">
        <FloralSpray className="-left-24 top-16 h-[30rem] w-72 -rotate-6 opacity-25" />
        <FloralSpray className="-bottom-24 -right-28 h-80 w-56 scale-x-[-1] rotate-12 opacity-20" />
        <div className="absolute inset-4 border border-[#9A7837]/20" />
        <motion.div {...reveal} className="relative mx-auto max-w-lg">
          <SectionHeading eyebrow="Confirmación de asistencia">
            Tu invitación
          </SectionHeading>

          {previewMode && (
            <div className="mx-auto mt-6 w-fit border border-[#A78340]/35 bg-[#F3E9D5] px-4 py-2 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-[#80652F]">
              Vista previa · Las respuestas están deshabilitadas
            </div>
          )}

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
                      disabled={previewMode || pasesSeleccionados <= 0}
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
                      disabled={previewMode || pasesSeleccionados >= maxPases}
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
                        disabled={previewMode || ninosSeleccionados <= 0}
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
                        disabled={
                          previewMode || ninosSeleccionados >= pasesSeleccionados
                        }
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
                  disabled={enviando || previewMode}
                  className={`w-full py-4 text-[10px] font-bold uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-2 disabled:opacity-60 ${pasesSeleccionados === 0 ? "bg-[#6B3A3A] text-[#F5E9D0] hover:bg-[#5A2E2E]" : "bg-[#37402F] text-[#E0C687] hover:bg-[#464B38]"}`}
                  style={{ fontFamily: "var(--font-cy-utility)" }}
                >
                  {previewMode ? (
                    <>
                      <Eye className="w-4 h-4" />
                      <span>Vista previa del formulario</span>
                    </>
                  ) : enviando ? (
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
      <footer className="relative overflow-hidden border-t-4 border-double border-[#9A7837]/35 bg-[#CDBD9C] px-6 py-16 text-center">
        <FloralSpray className="-bottom-28 -left-20 h-80 w-52 -rotate-12 opacity-30" />
        <FloralSpray className="-bottom-28 -right-20 h-80 w-52 scale-x-[-1] rotate-12 opacity-30" />
        <div className="relative mx-auto flex max-w-sm items-center justify-center gap-2">
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
    </motion.main>
      )}
    </AnimatePresence>
  );
}
