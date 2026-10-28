import { X } from "lucide-react";
import type { ReactNode } from "react";

export default function ModalHeader({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return <div className="sticky -top-6 z-20 -mx-6 -mt-6 mb-6 flex items-start justify-between gap-4 border-b border-stone-200 bg-white px-6 py-5">
    <div className="min-w-0">{children}</div>
    <button type="button" aria-label="Cerrar" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700"><X className="h-5 w-5"/></button>
  </div>;
}
