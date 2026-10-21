const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("../generated/prisma-client");

const prisma = new PrismaClient();
const inputPath = path.join(
  process.cwd(),
  "prisma",
  "backups",
  "sqlite-export.json",
);

const asDate = (value) => (value ? new Date(value) : null);

async function main() {
  if (!fs.existsSync(inputPath)) {
    throw new Error("No existe el respaldo sqlite-export.json.");
  }

  const backup = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const [usuariosActuales, eventosActuales, invitadosActuales] =
    await Promise.all([
      prisma.usuario.count(),
      prisma.evento.count(),
      prisma.invitado.count(),
    ]);

  if (usuariosActuales || eventosActuales || invitadosActuales) {
    throw new Error(
      "La base PostgreSQL no está vacía. Se canceló la importación para no sobrescribir datos.",
    );
  }

  const usuarios = backup.usuarios.map((usuario) => ({
    ...usuario,
    creado_en: asDate(usuario.creado_en),
  }));
  const eventos = backup.eventos.map((evento) => ({
    ...evento,
    fecha_evento: asDate(evento.fecha_evento),
    fecha_limite_rsvp: asDate(evento.fecha_limite_rsvp),
    creado_en: asDate(evento.creado_en),
    actualizado_en: asDate(evento.actualizado_en),
  }));
  const invitados = backup.invitados.map((invitado) => ({
    ...invitado,
    enviado_en: asDate(invitado.enviado_en),
    ultima_respuesta_en: asDate(invitado.ultima_respuesta_en),
    creado_en: asDate(invitado.creado_en),
    actualizado_en: asDate(invitado.actualizado_en),
  }));

  await prisma.$transaction(async (tx) => {
    await tx.usuario.createMany({ data: usuarios });
    await tx.evento.createMany({ data: eventos });
    await tx.invitado.createMany({ data: invitados });
  });

  const [usuariosImportados, eventosImportados, invitadosImportados] =
    await Promise.all([
      prisma.usuario.count(),
      prisma.evento.count(),
      prisma.invitado.count(),
    ]);

  if (
    usuariosImportados !== backup.counts.usuarios ||
    eventosImportados !== backup.counts.eventos ||
    invitadosImportados !== backup.counts.invitados
  ) {
    throw new Error("La verificación final de cantidades no coincide.");
  }

  console.log(
    `Importación verificada: ${usuariosImportados} usuarios, ${eventosImportados} eventos y ${invitadosImportados} invitados.`,
  );
}

main()
  .catch((error) => {
    console.error("No se pudo importar a PostgreSQL:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
