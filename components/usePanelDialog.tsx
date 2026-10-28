"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, X } from "lucide-react";

type Dialog = { message: string; confirmation: boolean; resolve: (answer: boolean) => void };

export default function usePanelDialog() {
  const [current, setCurrent] = useState<Dialog | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const close = (answer: boolean) => {
    current?.resolve(answer);
    setCurrent(null);
  };
  useEffect(() => {
    if (!current) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLButtonElement>("[data-initial-focus]")?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        current.resolve(false);
        setCurrent(null);
      }
      if (event.key === "Tab") {
        const buttons = panel.current?.querySelectorAll<HTMLButtonElement>("button");
        if (!buttons?.length) return;
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", keyboard, true);
    return () => {
      document.removeEventListener("keydown", keyboard, true);
      document.body.style.overflow = overflow;
      previousFocus?.focus();
      current.resolve(false);
    };
  }, [current]);
  const ask = (message: string, confirmation: boolean) => new Promise<boolean>(resolve => {
    setCurrent({ message, confirmation, resolve });
  });
  const dialog = current ? createPortal(
    <div className="dashboard-modal-enter fixed inset-0 z-[200] flex items-center justify-center bg-stone-950/55 p-4 backdrop-blur-sm" onClick={() => close(false)}>
      <div ref={panel} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} onClick={event => event.stopPropagation()} className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-[#eadbca] bg-white p-6 text-center shadow-2xl">
        <button type="button" aria-label="Cerrar" onClick={() => close(false)} className="absolute right-4 top-4 rounded-lg p-2 text-stone-400 hover:bg-stone-100"><X className="h-4 w-4" /></button>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600"><AlertTriangle className="h-7 w-7" /></div>
        <h2 id={titleId} className="mt-4 font-serif text-2xl font-bold text-[#2b211b]">{current.confirmation ? "Confirmar acción" : "Aviso"}</h2>
        <p id={descriptionId} className="mt-3 whitespace-pre-line text-sm leading-relaxed text-stone-600">{current.message}</p>
        <div className="mt-6 flex justify-center gap-3">
          {current.confirmation && <button type="button" data-initial-focus onClick={() => close(false)} className="rounded-xl px-5 py-3 text-sm font-semibold text-stone-600 hover:bg-stone-100">Cancelar</button>}
          <button type="button" data-initial-focus={current.confirmation ? undefined : true} onClick={() => close(true)} className={"rounded-xl px-5 py-3 text-sm font-semibold text-white " + (current.confirmation ? "bg-rose-600 hover:bg-rose-700" : "bg-[#2b211b] hover:bg-stone-800")}>{current.confirmation ? "Sí, continuar" : "Entendido"}</button>
        </div>
      </div>
    </div>, document.body,
  ) : null;
  return { confirmDialog: (message: string) => ask(message, true), notify: (message: string) => { void ask(message, false); }, dialog };
}
