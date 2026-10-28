import { CheckCircle2, LockKeyhole } from "lucide-react";

export default function AttendanceLockedNotice({ ingresados = 0, confirmados = 0 }: { ingresados?: number; confirmados?: number }) {
  return <div role="status" className="rounded-2xl border border-[#d9e5dc] bg-[#f4f8f3] px-5 py-6 text-center text-[#294638]">
    <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#e2ece1]"><CheckCircle2 className="h-6 w-6"/></span>
    <h3 className="font-serif text-xl">Tu asistencia ya está registrada</h3>
    <div className="mx-auto mt-4 grid max-w-xs grid-cols-2 divide-x divide-[#d9e5dc] rounded-xl bg-white/75 py-3">
      <div><strong className="block text-2xl">{ingresados}</strong><span className="text-xs">Personas ingresadas</span></div>
      <div><strong className="block text-2xl">{Math.max(0, confirmados - ingresados)}</strong><span className="text-xs">Pendientes de ingresar</span></div>
    </div>
    <p className="mt-2 text-xs text-[#526657]">De {confirmados} asistentes confirmados</p>
    <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[#526657]">Ya comenzó el ingreso de tu grupo. Tu confirmación y tus pases se conservarán tal como fueron registrados.</p>
    <div className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-[#526657]"><LockKeyhole className="h-3.5 w-3.5"/>Confirmación cerrada para cambios</div>
  </div>;
}
