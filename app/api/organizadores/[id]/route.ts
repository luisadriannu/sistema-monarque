import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { normalizePlan, planPresets } from "@/lib/organization-access";

const headers = { "Cache-Control": "no-store" };

// Cambiar el servicio prémium no debe depender de reenviar los datos de la
// cuenta (ni sobrescribirlos con una copia antigua del formulario).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentUser();
  if (admin?.rol !== "admin") return NextResponse.json({ error: "Acceso denegado." }, { status: 403, headers });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (body?.action === "restaurar") {
    const organization = await prisma.organizacion.findUnique({ where: { id }, select: { id: true } });
    if (!organization) return NextResponse.json({ error: "Organizador no encontrado." }, { status: 404, headers });
    await prisma.$transaction([
      prisma.organizacion.update({ where: { id }, data: { eliminado_en: null, eliminar_despues_de: null, estado_servicio: "activo" } }),
      prisma.usuario.updateMany({ where: { organizacion_id: id }, data: { session_version: { increment: 1 } } }),
    ]);
    return NextResponse.json({ ok: true, message: "Organización restaurada correctamente." }, { headers });
  }
  if (typeof body?.qr_checkin_habilitado !== "boolean") {
    return NextResponse.json({ error: "Indica si el acceso QR está habilitado." }, { status: 400, headers });
  }
  try {
    const exists = await prisma.organizacion.findUnique({ where: { id }, select: { id: true, plan: true } });
    if (!exists) return NextResponse.json({ error: "Organizador no encontrado." }, { status: 404, headers });
    const organizacion = await prisma.organizacion.update({
      where: { id },
      data: { qr_checkin_habilitado: exists.plan !== "basico" && body.qr_checkin_habilitado },
      select: { id: true, qr_checkin_habilitado: true },
    });
    return NextResponse.json({ ok: true, organizacion }, { headers });
  } catch (error) {
    console.error("Error al actualizar acceso QR", error);
    return NextResponse.json({ error: "No se pudo actualizar el acceso QR." }, { status: 500, headers });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentUser();
  if (admin?.rol !== "admin") return NextResponse.json({ error: "Acceso denegado." }, { status: 403, headers });
  const { id } = await params;
  const body = await request.json();
  const nombre = String(body.nombre || "").trim();
  const negocio = String(body.negocio || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const plan = normalizePlan(body.plan);
  const preset = planPresets[plan];
  const allowedStates = ["prueba", "activo", "suspendido", "vencido"];
  const estadoServicio = allowedStates.includes(body.estado_servicio) ? body.estado_servicio : "activo";
  const expiresAt = body.servicio_vence_en ? new Date(body.servicio_vence_en) : null;
  if (!nombre || !negocio || !email.includes("@")) return NextResponse.json({ error: "Datos incompletos." }, { status: 400, headers });
  if (password && password.length < 10) return NextResponse.json({ error: "La contraseña debe tener al menos 10 caracteres." }, { status: 400, headers });

  const organizer = await prisma.usuario.findFirst({ where: { organizacion_id: id, rol: "organizador" }, select: { id: true } });
  if (!organizer) return NextResponse.json({ error: "Organizador no encontrado." }, { status: 404, headers });
  await prisma.$transaction([
    prisma.organizacion.update({ where: { id }, data: {
      nombre: negocio,
      plan,
      estado_servicio: estadoServicio,
      servicio_vence_en: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
      max_clientes: preset.maxClientes,
      max_eventos_activos: preset.maxEventos,
      max_invitados_evento: preset.maxInvitados,
      qr_checkin_habilitado: preset.qr && Boolean(body.qr_checkin_habilitado),
      marca_personalizada: preset.marca,
    } }),
    prisma.usuario.update({ where: { id: organizer.id }, data: { nombre, email, ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}) } }),
  ]);
  return NextResponse.json({ ok: true }, { headers });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getCurrentUser();
  if (admin?.rol !== "admin") return NextResponse.json({ error: "Acceso denegado." }, { status: 403, headers });
  const { id } = await params;
  const organization = await prisma.organizacion.findUnique({ where: { id }, select: { nombre: true, eliminado_en: true } });
  if (!organization) return NextResponse.json({ error: "Organizador no encontrado." }, { status: 404, headers });
  if (organization.eliminado_en) return NextResponse.json({ ok: true, message: `${organization.nombre} ya se encuentra en la papelera.` }, { headers });
  const now = new Date();
  const purgeAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  await prisma.$transaction([
    prisma.organizacion.update({ where: { id }, data: { eliminado_en: now, eliminar_despues_de: purgeAt, estado_servicio: "suspendido" } }),
    prisma.usuario.updateMany({ where: { organizacion_id: id }, data: { session_version: { increment: 1 } } }),
  ]);
  return NextResponse.json({ ok: true, message: `${organization.nombre} se movió a la papelera durante 30 días.` }, { headers });
}
