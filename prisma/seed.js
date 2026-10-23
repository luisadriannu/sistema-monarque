const { PrismaClient } = require("../generated/prisma-client-v2");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const prisma = new PrismaClient();

function generateToken(length = 14) {
  const alphabet = "23456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = crypto.randomBytes(length);
  let token = "";
  for (let i = 0; i < length; i++) {
    token += alphabet[bytes[i] % alphabet.length];
  }
  return token;
}

async function main() {
  console.log("🌱 Iniciando carga de datos iniciales (Seed)...");

  // Limpiar datos existentes
  await prisma.invitado.deleteMany();
  await prisma.evento.deleteMany();
  await prisma.usuario.deleteMany();

  // 1. Crear Administradora
  const adminPassword = await bcrypt.hash("admin2025", 10);
  const admin = await prisma.usuario.create({
    data: {
      email: "admin@monarque.com",
      passwordHash: adminPassword,
      nombre: "Administradora Monarque",
      rol: "admin",
    },
  });
  console.log("✅ Administradora creada:", admin.email);

  // 2. Crear Clienta (Anfitriona)
  const clientaPassword = await bcrypt.hash("boda2025", 10);
  const clienta = await prisma.usuario.create({
    data: {
      email: "ana@monarque.com",
      passwordHash: clientaPassword,
      nombre: "Ana Martínez",
      rol: "clienta",
    },
  });
  console.log("✅ Clienta creada:", clienta.email);

  // 3. Crear Evento
  const fechaEvento = new Date();
  fechaEvento.setDate(fechaEvento.getDate() + 30); // En 30 días
  fechaEvento.setHours(17, 0, 0, 0);

  const fechaLimite = new Date();
  fechaLimite.setDate(fechaLimite.getDate() + 20); // En 20 días
  fechaLimite.setHours(23, 59, 59, 999);

  const evento = await prisma.evento.create({
    data: {
      usuario_id: clienta.id,
      slug: "boda-ana-y-luis",
      nombre: "Boda Ana & Luis",
      anfitriones: "Ana Martínez y Luis Rodríguez",
      fecha_evento: fechaEvento,
      lugar: "Hacienda San José, Carretera Cuernavaca-Acapulco Km 18, Morelos",
      fecha_limite_rsvp: fechaLimite,
      plantilla_mensaje:
        "¡Hola {nombre}! Con mucha ilusión te invitamos a celebrar nuestra boda. Tienes {pases} pases reservados con cariño. Por favor confírmanos aquí: {link}",
      plantilla_recordatorio:
        "¡Hola {nombre}! Te recordamos con mucho cariño que la fecha límite para confirmar tu asistencia a nuestra boda es el próximo día ({pases} pases). Por favor confírmanos en: {link}",
    },
  });
  console.log("✅ Evento creado:", evento.slug);

  // 4. Crear Invitados de prueba
  const invitadosData = [
    {
      nombre: "Familia Gómez Pérez",
      grupo: "Familia de la Novia",
      pases_asignados: 4,
      pases_confirmados: 3,
      estado: "confirmado",
      token: generateToken(),
      ultima_respuesta_en: new Date(),
    },
    {
      nombre: "Carlos Mendoza y Acompañante",
      grupo: "Amigos de Luis",
      pases_asignados: 2,
      pases_confirmados: null,
      estado: "visto",
      token: generateToken(),
      ultima_respuesta_en: null,
    },
    {
      nombre: "Dra. Sofía Alarcón",
      grupo: "Colegas",
      pases_asignados: 1,
      pases_confirmados: null,
      estado: "pendiente",
      token: generateToken(),
      ultima_respuesta_en: null,
    },
    {
      nombre: "Familia Treviño Morales",
      grupo: "Familia del Novio",
      pases_asignados: 3,
      pases_confirmados: 0,
      estado: "declinado",
      token: generateToken(),
      ultima_respuesta_en: new Date(),
    },
    {
      nombre: "Mateo Silva & Pareja",
      grupo: "Amigos de la Novia",
      pases_asignados: 2,
      pases_confirmados: 2,
      estado: "confirmado",
      token: generateToken(),
      ultima_respuesta_en: new Date(),
    },
    {
      nombre: "Tíos Fernando y Carmen",
      grupo: "Familia del Novio",
      pases_asignados: 2,
      pases_confirmados: null,
      estado: "pendiente",
      token: generateToken(),
      ultima_respuesta_en: null,
    },
  ];

  for (const inv of invitadosData) {
    await prisma.invitado.create({
      data: {
        ...inv,
        evento_id: evento.id,
      },
    });
  }

  console.log(`✅ ${invitadosData.length} invitados creados con éxito.`);
  console.log("\n Credenciales para probar:");
  console.log("👉 Clienta: ana@monarque.com | Contraseña: boda2025");
  console.log("👉 Admin:   admin@monarque.com | Contraseña: admin2025");
  console.log("👉 Link de ejemplo: http://localhost:3000/boda-ana-y-luis?id=" + invitadosData[0].token);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
