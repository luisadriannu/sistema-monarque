"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Lock,
  Mail,
  ArrowRight,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
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
      <path d="M12 211C45 154 72 91 157 12" stroke="currentColor" strokeWidth="1.2" />
      <path d="M42 159C15 151 9 129 13 113c25 5 39 19 29 46ZM69 107C47 88 52 64 63 51c19 13 25 32 6 56ZM105 68C91 43 104 22 119 13c14 17 12 36-14 55ZM53 139c31 5 51-11 59-27-25-7-47 0-59 27ZM85 91c29 5 49-9 57-25-23-8-44-1-57 25Z" fill="currentColor" opacity=".3" />
      <circle cx="39" cy="164" r="3" fill="currentColor" opacity=".55" />
      <circle cx="74" cy="111" r="2.5" fill="currentColor" opacity=".55" />
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        throw new Error(data.error || "Error al iniciar sesión.");
      }

      window.location.replace(
        data.user?.rol === "admin" || data.user?.rol === "organizador" ? "/dashboard/usuarios" : "/dashboard",
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
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#f2e8dc] p-4 sm:p-7">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(224,90,27,.13),transparent_28%),radial-gradient(circle_at_85%_82%,rgba(96,67,47,.16),transparent_30%)]" />
      <div className="absolute inset-0 opacity-35 [background-image:radial-gradient(rgba(92,65,46,.16)_0.7px,transparent_0.7px)] [background-size:9px_9px]" />
      <div className="pointer-events-none absolute inset-3 border border-[#b88b65]/25 sm:inset-5" />
      <div className="pointer-events-none absolute inset-5 border border-[#b88b65]/10 sm:inset-8" />

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
        className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#fed7aa]/30 blur-3xl"
      />
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.1, delay: 0.1, ease: "easeOut" }}
        className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-[#ffedd5]/50 blur-3xl"
      />

      <div className="relative z-10 grid w-full max-w-md overflow-hidden rounded-[2rem] border border-[#d9bea5] bg-white/80 shadow-[0_35px_100px_rgba(58,38,25,.22)] backdrop-blur-sm lg:max-w-5xl lg:grid-cols-[1.05fr_.95fr]">
        <motion.section
          initial={reduceMotion ? false : { opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative hidden min-h-[620px] overflow-hidden bg-[#30241e] p-12 text-[#fff8ee] lg:flex lg:flex-col lg:justify-between"
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
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-[#d7a86e]/60 bg-white">
              <Image src="/logo.png" alt="" width={44} height={44} className="h-full w-full object-cover" />
            </div>
            <div>
              <p className="font-serif text-lg font-semibold tracking-[0.16em]">MONARQUE</p>
              <p className="text-[9px] uppercase tracking-[0.3em] text-[#e6b37a]">Invitaciones Web</p>
            </div>
          </div>

          <div className="relative text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#d7a86e]/45 text-[#e6b37a]">
              <Sparkles className="h-6 w-6" strokeWidth={1.2} />
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
            <p className="mx-auto mt-6 max-w-sm text-sm leading-relaxed text-stone-300">
              Gestiona invitados, pases y confirmaciones mientras disfrutas de cada momento especial.
            </p>
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
        className="relative w-full bg-white/95 p-8 sm:p-11 lg:flex lg:flex-col lg:justify-center lg:p-14"
      >
        <div className="pointer-events-none absolute -right-20 -top-24 opacity-[.12] lg:hidden">
          <BotanicalCorner flip />
        </div>
        {/* Monarque Brand Header */}
        <div className="relative text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full overflow-hidden border-2 border-[#ebd9c4] bg-white mb-3 shadow-sm p-0.5">
            <Image
              src="/logo.png"
              alt="Monarque"
              width={64}
              height={64}
              className="w-full h-full object-cover rounded-full"
              priority
            />
          </div>
          <h1 className="font-serif text-3xl font-semibold tracking-wide text-[#2b211b]">
            MONARQUE
          </h1>
          <p className="text-xs uppercase tracking-widest text-[#e05a1b] font-semibold mt-1">
            Plan Elite • Control de Pases
          </p>
          <div className="h-[2px] w-12 bg-[#e05a1b] mx-auto mt-3 rounded-full opacity-80" />
          <p className="mx-auto mt-5 max-w-xs font-serif text-lg italic leading-relaxed text-stone-600">
            Bienvenida de nuevo a la organización de tu gran día.
          </p>
        </div>

        <AnimatePresence initial={false}>
          {error && (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-6 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl flex items-center gap-2"
            >
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
              <p>{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
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
                className="w-full pl-10 pr-4 py-3 bg-[#faf8f5] border border-stone-200 rounded-xl text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#e05a1b] focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
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
                className="w-full pl-10 pr-12 py-3 bg-[#faf8f5] border border-stone-200 rounded-xl text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#e05a1b] focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
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

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-[#2b211b] hover:bg-[#e05a1b] text-white font-semibold rounded-xl text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed group cursor-pointer"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Acceder a mi Dashboard</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </button>
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
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#fbf8f4]/95 backdrop-blur-md"
          >
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="flex flex-col items-center"
            >
              <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-[#ebd9c4] bg-white shadow-lg shadow-stone-200/60">
                <Image src="/logo.png" alt="" width={64} height={64} className="h-16 w-16 rounded-full object-cover" />
                <LoaderCircle className="absolute -inset-1 h-[88px] w-[88px] animate-spin text-[#e05a1b] motion-reduce:animate-none" strokeWidth={1.25} />
              </div>
              <p className="font-serif text-xl font-semibold tracking-wide text-[#2b211b]">
                Preparando tu dashboard
              </p>
              <p className="mt-2 text-sm text-stone-500">Un momento, estamos cargando tu evento…</p>
              <span className="sr-only">Cargando</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
