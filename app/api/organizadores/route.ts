import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@/generated/prisma-client-v2";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const headers = { "Cache-Control": "no-store" };

export async function GET() {
  const user = await getCurrentUser();
  if (user?.rol !== "admin") return NextResponse.json({ error: "Acceso denegado." }, { status: 403, headers });

  const organizaciones = await prisma.organizacion.findMany({
    include: {
      usuarios: {
        where: { rol: "organizador" },
        select: { id: true, nombre: true, email: true, creado_en: true },
      },
      _count: { select: { usuarios: true } },
    },
    orderBy: { creado_en: "desc" },
  });
  return NextResponse.json({ organizaciones }, { headers });
}

export async function POST(request: Request) {
  const admin = await getCurrentUser();
  if (admin?.rol !== "admin") return NextResponse.json({ error: "Acceso denegado." }, { status: 403, headers });

  try {
    const body = await request.json();
    const nombre = String(body.nombre || "").trim();
    const negocio = String(body.negocio || nombre).trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!nombre || !negocio || !email.includes("@")) {
      return NextResponse.json({ error: "Completa el nombre, negocio y correo." }, { status: 400, headers });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400, headers });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const organizacion = await prisma.organizacion.create({
      data: {
        nombre: negocio,
        qr_checkin_habilitado: Boolean(body.qr_checkin_habilitado),
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
