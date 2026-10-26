import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkRateLimit } from "@/lib/ratelimit";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, max-age=0" };

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim();
  if (!token || token.length > 200) {
    return NextResponse.json({ error: "Invitación no disponible." }, { status: 404, headers });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (!checkRateLimit(`entrada-publica:${ip}:${token}`, 60, 60)) {
    return NextResponse.json({ error: "Intenta nuevamente más tarde." }, { status: 429, headers });
  }
  try {
    const invitado = await prisma.invitado.findUnique({
      where: { token },
      select: {
        pases_ingresados: true,
        ultima_entrada_en: true,
        estado: true,
        pases_confirmados: true,
        codigo_entrada: true,
        evento: { select: { usuario: { select: { organizacion: { select: { qr_checkin_habilitado: true } } } } } },
      },
    });
    if (!invitado?.evento.usuario.organizacion?.qr_checkin_habilitado) {
      return NextResponse.json({ error: "Invitación no disponible." }, { status: 404, headers });
    }
    const escaneado = invitado.pases_ingresados > 0 || Boolean(invitado.ultima_entrada_en);
    const confirmado = invitado.estado === "confirmado" && (invitado.pases_confirmados ?? 0) > 0;
    const includeQr = new URL(request.url).searchParams.get("qr") === "1";
    const qrImage = includeQr && confirmado && !escaneado
      ? await QRCode.toDataURL(`monarque:entrada:${invitado.codigo_entrada}`, { width: 480, margin: 1, color: { dark: "#183126", light: "#fffaf0" } })
      : undefined;
    return NextResponse.json({ escaneado, confirmado, ...(qrImage ? { qrImage } : {}) }, { headers });
  } catch (error) {
    console.error("Error al consultar estado de entrada", error);
    return NextResponse.json({ error: "No se pudo consultar la entrada." }, { status: 503, headers });
  }
}
