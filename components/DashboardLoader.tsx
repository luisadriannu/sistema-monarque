import Image from "next/image";
import { LoaderCircle } from "lucide-react";

interface DashboardLoaderProps {
  title?: string;
  message?: string;
  label?: string;
}

export default function DashboardLoader({
  title = "Cargando tu evento",
  message = "Estamos preparando todos los detalles…",
  label = "Cargando dashboard",
}: DashboardLoaderProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className="flex min-h-[70vh] flex-col items-center justify-center px-5 text-center"
    >
      <div className="relative mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-[#ebd9c4] bg-white shadow-lg shadow-stone-200/60">
        <Image
          src="/logo.png"
          alt=""
          width={64}
          height={64}
          priority
          className="h-16 w-16 rounded-full object-cover"
        />
        <LoaderCircle
          className="absolute -inset-1 h-[88px] w-[88px] animate-spin text-[#e05a1b] motion-reduce:animate-none"
          strokeWidth={1.25}
        />
      </div>
      <p className="font-serif text-xl font-semibold tracking-wide text-[#2b211b]">
        {title}
      </p>
      <p className="mt-2 text-sm text-stone-500">{message}</p>
      <div className="mt-6 h-1 w-36 overflow-hidden rounded-full bg-stone-200/70">
        <span className="block h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-[#e05a1b] to-[#f59e0b] motion-reduce:animate-none" />
      </div>
      <span className="sr-only">Cargando</span>
    </div>
  );
}
