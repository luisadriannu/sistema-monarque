"use client";

import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { positionFloatingMenu } from "@/lib/floating-menu";

type Props = { anchor: HTMLElement; onClose: () => void; id: string; children: ReactNode };

export default function FloatingMenu({ anchor, onClose, id, children }: Props) {
  const menu = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const [position, setPosition] = useState<ReturnType<typeof positionFloatingMenu> | null>(null);

  useLayoutEffect(() => {
    const update = () => {
      if (!menu.current) return;
      const rect = anchor.getBoundingClientRect();
      if (!anchor.isConnected || rect.bottom <= 0 || rect.top >= window.innerHeight || rect.right <= 0 || rect.left >= window.innerWidth) {
        close.current();
        return;
      }
      setPosition(positionFloatingMenu(rect, menu.current.scrollHeight + 2, window.innerWidth, window.innerHeight));
    };
    update();
    menu.current?.querySelector<HTMLElement>("a[href], button:not(:disabled)")?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menu.current?.contains(event.target) && !anchor.contains(event.target)) close.current();
    };
    const onScroll = (event: Event) => {
      if (event.target instanceof Node && menu.current?.contains(event.target)) return;
      update();
    };
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    if (menu.current) observer?.observe(menu.current);
    observer?.observe(anchor);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("pointerdown", outside, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("pointerdown", outside, true);
    };
  }, [anchor]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" || event.key === "Tab") {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); }
      anchor.focus({ preventScroll: true });
      close.current();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = Array.from(menu.current?.querySelectorAll<HTMLElement>("a[href], button:not(:disabled)") || []);
    if (!items.length) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next].focus();
  };

  return createPortal(
    <div ref={menu} id={id} role="menu" aria-label="Acciones del invitado" onKeyDown={onKeyDown} onClick={event => event.stopPropagation()}
      className="fixed z-[45] overflow-y-auto overscroll-contain rounded-xl border border-[#ebd9c4] bg-white py-1.5 text-left text-xs shadow-xl"
      style={position ? { ...position, boxSizing: "border-box" } : { visibility: "hidden", width: 192 }}>
      {children}
    </div>, document.body,
  );
}
