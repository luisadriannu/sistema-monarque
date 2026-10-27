"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export default function AttendanceRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button type="button" disabled={pending} aria-busy={pending}
      onClick={() => startTransition(() => router.refresh())}
      className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
      <RefreshCw aria-hidden="true" className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
      {pending ? "Actualizando…" : "Actualizar asistencia"}
    </button>
  );
}
