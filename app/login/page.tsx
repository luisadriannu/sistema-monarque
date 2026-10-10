"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Lock, Mail, ArrowRight, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("ana@monarque.com");
  const [password, setPassword] = useState("boda2025");
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

      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Ocurrió un error inesperado.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#fbf8f4] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Elementos decorativos de fondo con tonos cálidos y mariposa monarca */}
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-[#fed7aa]/30 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-[#ffedd5]/50 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white border border-[#ebd9c4] rounded-3xl shadow-xl shadow-stone-200/50 p-8 md:p-10 relative z-10">
        {/* Monarque Brand Header */}
        <div className="text-center mb-8">
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
        </div>

        {error && (
          <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
            <p>{error}</p>
          </div>
        )}

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
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 bg-[#faf8f5] border border-stone-200 rounded-xl text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#e05a1b] focus:border-transparent transition-all"
              />
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

        {/* Demo info helper */}
        <div className="mt-8 pt-6 border-t border-stone-100 text-xs text-stone-500 bg-[#faf8f5] p-3.5 rounded-xl border border-[#ebd9c4]/50">
          <div className="flex items-center gap-1.5 font-medium text-stone-700 mb-1.5">
            <ShieldCheck className="w-4 h-4 text-[#e05a1b]" />
            <span>Acceso rápido de prueba:</span>
          </div>
          <div className="space-y-1 text-stone-600">
            <p>
              • <strong>Clienta:</strong> <span className="font-mono text-[11px]">ana@monarque.com</span> / <span className="font-mono text-[11px]">boda2025</span>
            </p>
            <p>
              • <strong>Admin:</strong> <span className="font-mono text-[11px]">admin@monarque.com</span> / <span className="font-mono text-[11px]">admin2025</span>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
