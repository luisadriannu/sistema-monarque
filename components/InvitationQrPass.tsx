"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";

export default function InvitationQrPass({
  image,
  guestName,
  passes,
  token,
  initialScanned = false,
  confirmed,
}: {
  image: string | null;
  guestName: string;
  passes: number;
  token: string;
  initialScanned?: boolean;
  confirmed: boolean;
}) {
  const [scanned, setScanned] = useState(initialScanned);
  const lastCheck = useRef(0);
  const [unavailable, setUnavailable] = useState(false);
  const [qrImage, setQrImage] = useState(image);
  const [serverConfirmed, setServerConfirmed] = useState(confirmed);

  useEffect(() => { setServerConfirmed(confirmed); }, [confirmed]);
  useEffect(() => { if (image) setQrImage(image); }, [image]);
  useEffect(() => { if (initialScanned) setScanned(true); }, [initialScanned]);
  useEffect(() => {
    if (scanned || unavailable || !token || !confirmed) return;
    let active = true;
    let inFlight = false;
    let controller: AbortController | null = null;
    const check = async () => {
      if (!active || inFlight || document.visibilityState !== "visible" || Date.now() - lastCheck.current < 15000) return;
      lastCheck.current = Date.now();
      inFlight = true;
      controller = new AbortController();
      try {
        const response = await fetch(`/api/invitacion/entrada?token=${encodeURIComponent(token)}${!qrImage ? "&qr=1" : ""}`, { cache: "no-store", signal: controller.signal });
        if (response.status === 404) {
          if (active) setUnavailable(true);
          return;
        }
        if (!response.ok) return;
        const data = await response.json();
        if (active && typeof data.confirmado === "boolean") setServerConfirmed(data.confirmado);
        if (active && data.confirmado === true && typeof data.qrImage === "string") setQrImage(data.qrImage);
        if (active && data.escaneado === true) setScanned(true);
      } catch {
        // Conserva el pase y reintenta ante una interrupción temporal de red.
      } finally { inFlight = false; }
    };
    // La página del servidor ya entrega el estado actual. Solo pedimos el QR
    // aquí cuando acaba de confirmarse sin recargar, o al regresar a la pestaña.
    if (!qrImage) void check();
    const onVisibility = () => { if (document.visibilityState === "visible") void check(); };
    const onFocus = () => { void check(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [token, scanned, unavailable, confirmed, qrImage]);

  return (
    <section
      id="pase-qr"
      className="relative scroll-mt-6 overflow-hidden bg-[#183126] px-5 py-20 text-center text-[#f5eddc]"
    >
      <div className="pointer-events-none absolute inset-4 rounded-[2.5rem] border border-[#c7aa67]/35" />
      <div className="relative mx-auto max-w-md">
        <p className="text-xs font-bold uppercase tracking-[.35em] text-[#c7aa67]">
          Pase de entrada
        </p>
        {scanned ? (
          <div role="status" aria-live="polite" className="mt-8 rounded-3xl border border-[#c7aa67]/40 p-6">
            <CheckCircle2 className="mx-auto h-14 w-14 text-[#c7aa67]" />
            <h2 className="mt-4 font-serif text-3xl">Tu entrada ya fue escaneada</h2>
            <p className="mt-3 text-sm text-[#f5eddc]/80">Tu ingreso ya está registrado. Este código no se puede volver a utilizar.</p>
          </div>
        ) : unavailable ? (
          <p role="status" className="mt-8 text-sm">Este pase ya no está disponible. Contacta a los anfitriones.</p>
        ) : !confirmed || !serverConfirmed ? (
          <div role="status" className="mt-8 rounded-3xl border border-[#c7aa67]/40 p-6">
            <h2 className="font-serif text-3xl">Confirma tu asistencia para obtener tu pase QR</h2>
            <p className="mt-3 text-sm text-[#f5eddc]/80">Tu código de entrada aparecerá aquí después de confirmar tus pases.</p>
          </div>
        ) : !qrImage ? (
          <p role="status" className="mt-8 text-sm">Estamos preparando tu pase QR…</p>
        ) : <>
        <h2 className="mt-4 font-serif text-4xl">Tu acceso al evento</h2>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-[#f5eddc]/70">
          Presenta este código al equipo de recepción. Es personal y registra
          hasta {passes} {passes === 1 ? "acceso" : "accesos"}.
        </p>
        <div className="mx-auto mt-8 w-fit rounded-[2rem] bg-[#fffaf0] p-5 shadow-2xl shadow-black/30">
          <Image
            src={qrImage}
            alt={`Código QR de entrada para ${guestName}`}
            width={240}
            height={240}
            unoptimized
            className="h-56 w-56"
          />
        </div>
        </>}
        <p className="mt-5 font-serif text-2xl">{guestName}</p>
        {!scanned && !unavailable && confirmed && serverConfirmed && qrImage && <p className="mt-1 text-[10px] uppercase tracking-[.25em] text-[#c7aa67]">
          No compartas este código
        </p>}
      </div>
    </section>
  );
}
