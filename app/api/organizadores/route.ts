import { DIRECT_ORGANIZATION_ID } from "@/lib/management-access";
import { isValidName, NAME_ERROR } from "@/lib/names";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@/generated/prisma-client-v3";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { normalizeAvailablePlan, planPresets } from "@/lib/organization-access";
import { endOfDayMexicoDate, toDateInputValue } from "@/lib/utils";

const headers = { "Cache-Control": "no-store" };

export async function GET() {
  const user = await getCurrentUser();
  if (user?.rol !== "admin") return NextResponse.json({ error: "Acceso denegado." }, { status: 403, headers });

  const all = await prisma.organizacion.findMany({
    where: { id: { not: DIRECT_ORGANIZATION_ID } },
    include: {
      usuarios: {
        where: { rol: "organizador" },
        select: { id: true, nombre: true, email: true, creado_en: true },
      },
      _count: { select: { usuarios: true } },
    },
    orderBy: { creado_en: "desc" },
  });
  return NextResponse.json({
    organizaciones: all.filter(item => !item.eliminado_en),
    eliminadas: all.filter(item => Boolean(item.eliminado_en)),
  }, { headers });
}

export async function POST(request: Request) {
  const admin = await getCurrentUser();
  if (admin?.rol !== "admin") return NextResponse.json({ error: "Acceso denegado." }, { status: 403, headers });

  try {
    const body = await request.json();
    const nombre = String(body.nombre || "").trim();
    if (!isValidName(nombre)) return NextResponse.json({ error: NAME_ERROR }, { status: 400 });
    const negocio = String(body.negocio || nombre).trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const plan = normalizeAvailablePlan(body.plan);
    const preset = planPresets[plan];
    const expiryInput = String(body.servicio_vence_en || "");
    if (expiryInput && expiryInput < toDateInputValue(new Date())) {
      return NextResponse.json({ error: "El vencimiento de la licencia debe ser hoy o una fecha futura." }, { status: 400, headers });
    }
    const expiresAt = expiryInput ? endOfDayMexicoDate(expiryInput) : null;
    if (!nombre || !negocio || !email.includes("@")) {
      return NextResponse.json({ error: "Completa el nombre, negocio y correo." }, { status: 400, headers });
    }
    if (password.length < 10) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 10 caracteres." }, { status: 400, headers });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const organizacion = await prisma.organizacion.create({
      data: {
        nombre: negocio,
        plan,
        estado_servicio: "activo",
        servicio_vence_en: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null,
        max_clientes: preset.maxClientes,
        max_eventos_activos: preset.maxEventos,
        max_invitados_evento: preset.maxInvitados,
        qr_checkin_habilitado: Boolean(body.qr_checkin_habilitado),
        marca_personalizada: preset.marca,
        usuarios: { create: { nombre, email, passwordHash, rol: "organizador" } },
      },
      include: { usuarios: { where: { rol: "organizador" }, select: { id: true, nombre: true, email: true } } },
    });
    return NextResponse.json({ ok: true, organizacion }, { status: 201, headers });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Ese correo ya está registrado." }, { status: 409, headers });
    }
    console.error(error);
    return NextResponse.json({ error: "No se pudo crear el organizador." }, { status: 500, headers });
  }
}
