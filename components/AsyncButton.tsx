"use client";

import { useRef, useState, type ButtonHTMLAttributes, type MouseEvent } from "react";
import { LoaderCircle } from "lucide-react";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  onClick?: (event: MouseEvent<HTMLButtonElement>) => unknown | Promise<unknown>;
  loading?: boolean;
  loadingText?: string;
};

export default function AsyncButton({ onClick, loading = false, loadingText = "Procesando…", disabled, children, className = "", type = "button", ...props }: Props) {
  const locked = useRef(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const busy = loading || pending;

  const handleClick = async (event: MouseEvent<HTMLButtonElement>) => {
    if (locked.current || loading || disabled) { event.preventDefault(); return; }
    if (!onClick) return;
    locked.current = true;
    setPending(true);
    setFailed(false);
    try { await onClick(event); }
    catch (error) { console.error("Error al ejecutar acción", error); setFailed(true); }
    finally { locked.current = false; setPending(false); }
  };

  return <>
    <button {...props} type={type} disabled={disabled || busy} aria-busy={busy} onClick={handleClick} className={`${className} disabled:cursor-wait disabled:opacity-60`}>
      {busy ? <span className="inline-flex items-center justify-center gap-2" role="status"><LoaderCircle aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin" />{loadingText || <span className="sr-only">Procesando…</span>}</span> : children}
    </button>
    {failed && <span role="alert" className="block text-xs text-rose-700">No se pudo completar la acción. Inténtalo de nuevo.</span>}
  </>;
}
