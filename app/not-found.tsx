import Link from "next/link";
import { Sparkles, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#faf8f5] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-[#e6d7c3] rounded-3xl p-8 text-center shadow-xl shadow-stone-200/50">
        <div className="w-12 h-12 rounded-2xl bg-[#faf8f5] border border-[#e6d7c3] text-[#c5a059] mx-auto flex items-center justify-center mb-4">
          <Sparkles className="w-6 h-6 text-[#c5a059]" />
        </div>

        <h1 className="font-serif text-3xl font-bold text-stone-900 mb-2">
          Página No Encontrada
        </h1>

        <p className="text-xs text-stone-600 leading-relaxed mb-6">
          La dirección a la que intentas ingresar no existe o ha sido trasladada.
        </p>

        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-stone-900 hover:bg-[#946943] text-white text-xs font-semibold rounded-xl transition-all shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al Inicio</span>
        </Link>
      </div>
    </main>
  );
}
