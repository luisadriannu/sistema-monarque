"use client";

export async function downloadGuestQr(token: string, guestName: string) {
  const response = await fetch(`/api/invitacion/entrada?token=${encodeURIComponent(token)}&download=1`, { cache: "no-store" });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "No se pudo descargar el QR.");
  }
  const blob = await response.blob();
  if (!blob.type.startsWith("image/png")) throw new Error("No se pudo generar el archivo QR.");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const name = guestName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "invitado";
  link.download = `pase-qr-${name}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
