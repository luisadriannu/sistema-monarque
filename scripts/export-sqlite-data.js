const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("../generated/prisma-client-v2");

const prisma = new PrismaClient();
const outputPath = path.join(
  process.cwd(),
  "prisma",
  "backups",
  "sqlite-export.json",
);

async function main() {
  const [usuarios, eventos, invitados] = await Promise.all([
    prisma.usuario.findMany({ orderBy: { creado_en: "asc" } }),
    prisma.evento.findMany({ orderBy: { creado_en: "asc" } }),
    prisma.invitado.findMany({ orderBy: { creado_en: "asc" } }),
  ]);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        counts: {
          usuarios: usuarios.length,
          eventos: eventos.length,
          invitados: invitados.length,
        },
        usuarios,
        eventos,
        invitados,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(
    `Exportación creada: ${usuarios.length} usuarios, ${eventos.length} eventos y ${invitados.length} invitados.`,
  );
}

main()
  .catch((error) => {
    console.error("No se pudo exportar SQLite:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
