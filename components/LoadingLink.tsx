"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition, type AnchorHTMLAttributes, type MouseEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { beginNavigation } from "@/lib/navigation-busy";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  loadingText?: string;
};

export default function LoadingLink({ href, loadingText = "Cargando…", children, onClick, target, className = "", ...props }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const locked = useRef(false);
  const finishNavigation = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!pending) {
      locked.current = false;
      finishNavigation.current?.();
      finishNavigation.current = null;
    }
  }, [pending]);
  useEffect(() => () => { finishNavigation.current?.(); }, []);

  const navigate = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || (target && target !== "_self")) return;
    event.preventDefault();
    if (locked.current) return;
    locked.current = true;
    finishNavigation.current = beginNavigation();
    try { startTransition(() => router.push(href)); }
    catch (error) { locked.current = false; finishNavigation.current?.(); finishNavigation.current = null; throw error; }
  };

  return <Link {...props} prefetch={false} href={href} target={target} onClick={navigate} aria-busy={pending} aria-disabled={pending} className={`${className} ${pending ? "cursor-wait opacity-70" : ""}`}>
    {pending ? <span className="inline-flex items-center gap-2" role="status"><LoaderCircle aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin" />{loadingText}</span> : children}
  </Link>;
}
