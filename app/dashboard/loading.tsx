import Image from "next/image";
import { LoaderCircle } from "lucide-react";

export default function DashboardLoading() {
  return (
    <div
      role="status"
      aria-label="Cargando dashboard"
      className="flex min-h-[70vh] flex-col items-center justify-center text-center"
    >
      <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-[#ebd9c4] bg-white shadow-lg shadow-stone-200/60">
        <Image src="/logo.png" alt="" width={64} height={64} className="h-16 w-16 rounded-full object-cover" />
        <LoaderCircle className="absolute -inset-1 h-[88px] w-[88px] animate-spin text-[#e05a1b] motion-reduce:animate-none" strokeWidth={1.25} />
      </div>
      <p className="font-serif text-xl font-semibold tracking-wide text-[#2b211b]">Cargando tu evento</p>
      <p className="mt-2 text-sm text-stone-500">Estamos preparando todos los detalles…</p>
      <span className="sr-only">Cargando</span>
    </div>
  );
}
