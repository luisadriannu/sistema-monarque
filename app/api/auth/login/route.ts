import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { createSessionToken, setSessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const email = body?.email;
    const password = body?.password;

    if (typeof email !== "string" || !email.trim() || typeof password !== "string" || !password) {
      return NextResponse.json(
        { error: "Por favor ingresa tu correo y contraseña." },
        { status: 400 }
      );
    }

    if (!process.env.DATABASE_URL?.trim()) {
      console.error("Error en login: falta configurar DATABASE_URL.");
      return NextResponse.json(
        { error: "El inicio de sesión no está disponible porque falta configurar la conexión a la base de datos (DATABASE_URL)." },
        { status: 503 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.usuario.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Credenciales incorrectas. Verifica tus datos." },
        { status: 401 }
      );
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return NextResponse.json(
        { error: "Credenciales incorrectas. Verifica tus datos." },
        { status: 401 }
      );
    }

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      rol: user.rol,
      nombre: user.nombre,
    });

    await setSessionCookie(token);

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        rol: user.rol,
      },
    });
  } catch (error) {
    console.error("Error en login:", error);
    return NextResponse.json(
      { error: "Ocurrió un error al procesar el inicio de sesión." },
      { status: 500 }
    );
  }
}
