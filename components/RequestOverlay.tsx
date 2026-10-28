"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { LoaderCircle } from "lucide-react";

export default function RequestOverlay({ navigating = false }: { navigating?: boolean }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".dashboard-theme");
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const previousInert = root?.inert ?? false;
    if (root) { root.inert = true; root.setAttribute("aria-busy", "true"); }
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const blockKeys = (event: KeyboardEvent) => { event.preventDefault(); event.stopImmediatePropagation(); };
    window.addEventListener("keydown", blockKeys, true);
    return () => {
      window.removeEventListener("keydown", blockKeys, true);
      if (root) { root.inert = previousInert; root.removeAttribute("aria-busy"); }
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(<div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="request-overlay-title" aria-describedby="request-overlay-description" className="fixed inset-0 z-[1000] flex items-center justify-center bg-stone-950/45 p-5 backdrop-blur-sm outline-none">
    <div role="status" className="w-full max-w-xs rounded-3xl border border-stone-200 bg-white px-6 py-8 text-center shadow-2xl">
      <LoaderCircle aria-hidden="true" className="mx-auto mb-4 h-10 w-10 animate-spin text-[#e05a1b] motion-reduce:animate-none"/>
      <h2 id="request-overlay-title" className="font-serif text-xl font-semibold text-stone-900">{navigating ? "Cargando sección" : "Procesando solicitud"}</h2>
      <p id="request-overlay-description" className="mt-2 text-sm leading-relaxed text-stone-500">{navigating ? "Espera un momento mientras preparamos la información." : "Espera un momento mientras completamos la operación."}</p>
    </div>
  </div>, document.body);
}
