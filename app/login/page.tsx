"use client";
import ThemeToggle from "@/components/ThemeToggle";
import AsyncButton from "@/components/AsyncButton";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Lock,
  Mail,
  ArrowRight,
  LoaderCircle,
  ShieldCheck,
  Eye,
  EyeOff,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

function BotanicalCorner({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 180 220"
      fill="none"
      aria-hidden="true"
      className="h-52 w-44 text-[#bf8b55]"
      style={flip ? { transform: "scale(-1)" } : undefined}
    >
      <path
        d="M12 211C45 154 72 91 157 12"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M42 159C15 151 9 129 13 113c25 5 39 19 29 46ZM69 107C47 88 52 64 63 51c19 13 25 32 6 56ZM105 68C91 43 104 22 119 13c14 17 12 36-14 55ZM53 139c31 5 51-11 59-27-25-7-47 0-59 27ZM85 91c29 5 49-9 57-25-23-8-44-1-57 25Z"
        fill="currentColor"
        opacity=".3"
      />
      <circle cx="39" cy="164" r="3" fill="currentColor" opacity=".55" />
      <circle cx="74" cy="111" r="2.5" fill="currentColor" opacity=".55" />
    </svg>
  );
}

function MonarchButterfly({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 130"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {/* Alas simétricas con nervaduras y puntos en el borde de la monarca. */}
      {[false, true].map((mirrored) => (
        <g
          key={String(mirrored)}
          transform={mirrored ? "translate(160 0) scale(-1 1)" : undefined}
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d="M78 65C66 37 36 8 15 10C3 12 7 45 18 60C27 73 52 76 78 65Z"
            fill="currentColor"
            fillOpacity=".16"
          />
          <path
            d="M78 66C57 63 21 65 19 84C17 104 39 124 54 116C68 109 74 84 78 66Z"
            fill="currentColor"
            fillOpacity=".22"
          />
          <path
            d="M76 63L22 20M76 63L15 38M76 63L26 60M76 69L29 83M76 69L42 108M76 69L59 103"
            opacity=".65"
          />
          <path
            d="M65 56C48 36 29 23 18 23M61 68C40 73 31 88 35 101"
            opacity=".5"
          />
          <g fill="currentColor" stroke="none" opacity=".85">
            <ellipse cx="14" cy="19" rx="1.7" ry="2.4" />
            <ellipse cx="14" cy="31" rx="1.6" ry="2.5" />
            <ellipse
              cx="17"
              cy="44"
              rx="1.6"
              ry="2.5"
              transform="rotate(-20 17 44)"
            />
            <circle cx="23" cy="55" r="1.7" />
            <circle cx="25" cy="83" r="1.6" />
            <circle cx="27" cy="94" r="1.6" />
            <circle cx="34" cy="104" r="1.6" />
            <circle cx="44" cy="111" r="1.6" />
            <circle cx="54" cy="109" r="1.6" />
          </g>
        </g>
      ))}
      <path
        d="M80 49C76 56 77 83 80 92C83 83 84 56 80 49Z"
        fill="currentColor"
      />
      <path
        d="M79 51C77 41 73 37 69 36M81 51C83 41 87 37 91 36"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function LoginPage() {
  const reduceMotion = useReducedMotion();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (
      new URLSearchParams(window.location.search).get("reason") ===
      "session_expired"
    ) {
      setError(
        "Tu sesión ha caducado por inactividad o vencimiento. Inicia sesión nuevamente.",
      );
    }
  }, []);
  const [rateLimit, setRateLimit] = useState<{
    email: string;
    blockedUntil: number;
  } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const normalizedEmail = email.trim().toLowerCase();
  const rateLimitSeconds =
    rateLimit?.email === normalizedEmail
      ? Math.max(0, Math.ceil((rateLimit.blockedUntil - now) / 1000))
      : 0;
  const isRateLimited = rateLimitSeconds > 0;

  useEffect(() => {
    if (!isRateLimited) return;

    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [isRateLimited]);

  const retryTimeLabel = `${Math.floor(rateLimitSeconds / 60)}:${String(
    rateLimitSeconds % 60,
  ).padStart(2, "0")}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || isRateLimited) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          const retryAfter = Number.parseInt(
            res.headers.get("Retry-After") ?? "60",
            10,
          );
          const retryAfterSeconds =
            Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60;

          setNow(Date.now());
          setRateLimit({
            email: normalizedEmail,
            blockedUntil: Date.now() + retryAfterSeconds * 1000,
          });
        }
        throw new Error(data.error || "Error al iniciar sesión.");
      }

      window.location.replace(
        data.user?.rol === "admin" || data.user?.rol === "organizador"
          ? "/dashboard/usuarios"
          : data.user?.rol === "recepcionista"
            ? "/dashboard/escanear"
            : "/dashboard",
      );
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Ocurrió un error inesperado.");
      }
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#f2e8dc] dark:bg-[#0c0d10] dark:text-[#f2f3f5] p-4 sm:p-7">
      <div className="absolute inset-0 dark:opacity-20 bg-[radial-gradient(circle_at_15%_15%,rgba(224,90,27,.13),transparent_28%),radial-gradient(circle_at_85%_82%,rgba(96,67,47,.16),transparent_30%)]" />
      <div className="absolute inset-0 opacity-35 dark:opacity-10 [background-image:radial-gradient(rgba(92,65,46,.16)_0.7px,transparent_0.7px)] [background-size:9px_9px]" />
      <div className="pointer-events-none absolute inset-3 border border-[#b88b65]/25 dark:border-[#26272b] sm:inset-5" />
      <div className="pointer-events-none absolute inset-5 border border-[#b88b65]/10 dark:border-[#222428] sm:inset-8" />

      <div className="pointer-events-none absolute -left-16 -top-14 opacity-45">
        <BotanicalCorner />
      </div>
      <div className="pointer-events-none absolute -bottom-14 -right-16 opacity-45">
        <BotanicalCorner flip />
      </div>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.1, ease: "easeOut" }}
        className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#fed7aa]/30 dark:bg-[#2b2d31]/20 blur-3xl"
      />
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.1, delay: 0.1, ease: "easeOut" }}
        className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-[#ffedd5]/50 dark:bg-[#2b2d31]/20 blur-3xl"
      />

      <div
        className="pointer-events-none absolute inset-0 overflow-hidden text-[#bf8b55] dark:text-[#c99b68]"
        aria-hidden="true"
      >
        <MonarchButterfly className="absolute left-3 top-8 w-24 -rotate-[24deg] opacity-45 sm:left-[8%] sm:top-[12%] sm:w-36 dark:opacity-30" />
        <MonarchButterfly className="absolute bottom-6 right-2 w-28 rotate-[22deg] opacity-40 sm:bottom-[10%] sm:right-[6%] sm:w-40 dark:opacity-30" />
        <MonarchButterfly className="absolute right-[12%] top-[7%] hidden w-20 rotate-[12deg] opacity-30 lg:block dark:opacity-25" />
      </div>

      <div className="relative z-10 grid w-full max-w-md overflow-hidden rounded-[2rem] border border-[#d9bea5] dark:border-[#26272b] bg-white/80 dark:bg-[#16171a] shadow-[0_35px_100px_rgba(58,38,25,.22)] backdrop-blur-sm lg:max-w-5xl lg:grid-cols-[1.05fr_.95fr]">
        <motion.section
          initial={reduceMotion ? false : { opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative hidden min-h-[620px] overflow-hidden bg-[#30241e] dark:bg-[#111214] p-12 text-[#fff8ee] lg:flex lg:flex-col lg:justify-between"
        >
          <div className="absolute inset-0 opacity-25 [background-image:repeating-linear-gradient(90deg,rgba(255,255,255,.035)_0,rgba(255,255,255,.035)_1px,transparent_1px,transparent_8px)]" />
          <div className="absolute -right-20 -top-12 opacity-25">
            <BotanicalCorner flip />
          </div>
          <div className="absolute -bottom-20 -left-16 opacity-20">
            <BotanicalCorner />
          </div>
          <div className="absolute inset-5 rounded-t-[12rem] border border-[#d7a86e]/25" />
          <div className="absolute inset-8 rounded-t-[11rem] border border-[#d7a86e]/10" />

          <div className="relative flex items-center gap-3">
            <div>
              <p className="font-serif text-lg font-semibold tracking-[0.16em]">
                MONARQUE
              </p>
              <p className="text-[9px] uppercase tracking-[0.3em] text-[#e6b37a]">
                Invitaciones Web
              </p>
            </div>
          </div>

          <div className="relative text-center">
            <div className="relative mx-auto w-24">
              <div aria-hidden="true" className="pointer-events-none absolute inset-3 rounded-full bg-[#efac62]/10 blur-2xl dark:bg-[#efac62]/20" />
              <Image src="/monarch-butterfly-elegant.svg" alt="Mariposa monarca de alas naranjas con detalles negros y puntos marfil" width={220} height={175} className="relative h-auto w-full drop-shadow-[0_8px_18px_rgba(0,0,0,.2)] dark:drop-shadow-[0_0_12px_rgba(239,172,98,.25)]" />
            </div>
            <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.42em] text-[#e6b37a]">
              Todo en un solo lugar
            </p>
            <h2 className="mt-5 font-serif text-5xl font-medium italic leading-[1.02]">
              Cada detalle de tu evento, bajo control
            </h2>
            <div className="mx-auto mt-7 flex max-w-xs items-center gap-4 text-[#d7a86e]">
              <span className="h-px flex-1 bg-current opacity-40" />
              <span className="text-lg">◆</span>
              <span className="h-px flex-1 bg-current opacity-40" />
            </div>
          </div>

          <div className="relative flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.22em] text-stone-400">
            <ShieldCheck className="h-4 w-4 text-[#e6b37a]" />
            Acceso privado y seguro
          </div>
        </motion.section>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full bg-white/95 dark:bg-[#16171a] p-8 sm:p-11 lg:flex lg:flex-col lg:justify-center lg:p-14"
        >
          <div className="pointer-events-none absolute -right-20 -top-24 opacity-[.12] lg:hidden">
            <BotanicalCorner flip />
          </div>
          <div className="relative mb-4 flex justify-end">
            <ThemeToggle compact />
          </div>
          {/* Monarque Brand Header */}
          <div className="relative text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full overflow-hidden border-2 border-[#ebd9c4] bg-white mb-3 shadow-sm p-0.5">
              <Image
                src="/logo.png"
                alt="Monarque"
                width={80}
                height={80}
                className="w-full h-full object-cover rounded-full"
                priority
              />
            </div>
            <h1 className="font-serif text-3xl font-semibold tracking-wide text-[#2b211b] dark:text-[#f2f3f5]">
              MONARQUE
            </h1>
            <p className="text-xs uppercase tracking-widest text-[#e05a1b] font-semibold mt-1">
              Plan Elite • Control de Pases
            </p>
            <div className="h-[2px] w-12 bg-[#e05a1b] mx-auto mt-3 rounded-full opacity-80" />
            <p className="mx-auto mt-5 max-w-xs font-serif text-lg italic leading-relaxed text-stone-600 dark:text-[#b5bac1]">
              Bienvenida(o) de nuevo a la organización de tu gran día.
            </p>
          </div>

          <AnimatePresence initial={false}>
            {error && (
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-6 p-3.5 bg-rose-50 dark:bg-[#2b151b] border border-rose-200 dark:border-[#6b2939] text-rose-700 dark:text-rose-300 text-sm rounded-xl flex items-center gap-2"
              >
                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                <p>
                  {isRateLimited
                    ? `Demasiados intentos. Podrás volver a intentarlo en ${retryTimeLabel}.`
                    : error}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-[#dbdee1] uppercase tracking-wider mb-2">
                Correo Electrónico
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  className="w-full pl-10 pr-4 py-3 bg-[#faf8f5] dark:bg-[#1e1f22] border border-stone-200 dark:border-[#2b2d31] dark:placeholder:text-[#949ba4] rounded-xl text-stone-900 dark:text-[#f2f3f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#e05a1b] focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-[#dbdee1] uppercase tracking-wider mb-2">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-12 py-3 bg-[#faf8f5] dark:bg-[#1e1f22] border border-stone-200 dark:border-[#2b2d31] dark:placeholder:text-[#949ba4] rounded-xl text-stone-900 dark:text-[#f2f3f5] text-sm focus:outline-none focus:ring-2 focus:ring-[#e05a1b] focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={
                    showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-stone-400 transition-colors hover:text-[#e05a1b] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#e05a1b]"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <AsyncButton
              type="submit"
              disabled={loading || isRateLimited}
              className="w-full py-3.5 px-4 bg-[#2b211b] dark:bg-[#2b2d31] dark:border dark:border-[#3f4147] hover:bg-[#e05a1b] dark:hover:bg-[#35373c] text-white font-semibold rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed group cursor-pointer"
              loadingText="Ingresando…"
              loading={loading}
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>
                    {isRateLimited
                      ? `Intenta de nuevo en ${retryTimeLabel}`
                      : "Acceder a mi Dashboard"}
                  </span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </AsyncButton>
          </form>
        </motion.div>
      </div>

      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="status"
            aria-live="polite"
            aria-label="Iniciando sesión y preparando tu dashboard"
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#fbf8f4]/95 dark:bg-[#0c0d10]/95 backdrop-blur-md"
          >
            <motion.div
              initial={
                reduceMotion ? false : { opacity: 0, y: 12, scale: 0.96 }
              }
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="flex flex-col items-center"
            >
              <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-[#ebd9c4] bg-white shadow-lg shadow-stone-200/60 dark:shadow-black/30">
                <Image
                  src="/logo.png"
                  alt=""
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-full object-cover"
                />
                <LoaderCircle
                  className="absolute -inset-1 h-[88px] w-[88px] animate-spin text-[#e05a1b] motion-reduce:animate-none"
                  strokeWidth={1.25}
                />
              </div>
              <p className="font-serif text-xl font-semibold tracking-wide text-[#2b211b] dark:text-[#f2f3f5]">
                Preparando tu dashboard
              </p>
              <p className="mt-2 text-sm text-stone-500 dark:text-[#b5bac1]">
                Un momento, estamos cargando tu evento…
              </p>
              <span className="sr-only">Cargando</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
