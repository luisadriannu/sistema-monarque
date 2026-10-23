const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("../generated/prisma-client-v2");

const prisma = new PrismaClient();
const dataPath = path.join(
  process.cwd(),
  "app",
  "data",
  "carlosYYazmin.json",
);

async function main() {
  const invitationData = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const { media: _localMedia, ...databaseInvitationData } = invitationData;

  if (databaseInvitationData.seo) {
    const { image: _localSeoImage, ...seoWithoutImage } =
      databaseInvitationData.seo;
    databaseInvitationData.seo = seoWithoutImage;
  }

  const slug = process.env.EVENT_SLUG || "boda-yazmin-y-cesar";
  const [groom = "Carlos", bride = "Yazmin"] = invitationData.event.name
    .split("&")
    .map((name) => name.trim());
  const shortGroom = groom.split(/\s+/)[0];
  const shortBride = bride.split(/\s+/)[0];
  const eventDate = new Date(invitationData.event.date);

  if (Number.isNaN(eventDate.getTime())) {
    throw new Error("La fecha de la invitación no es válida.");
  }

  const updated = await prisma.evento.update({
    where: { slug },
    data: {
      nombre: `Boda ${shortGroom} & ${shortBride}`,
      anfitriones: `${groom} y ${bride}`,
      fecha_evento: eventDate,
      lugar: invitationData.location.reception,
      // Las fotografías permanecen como archivos estáticos del proyecto.
      configuracion_invitacion: databaseInvitationData,
    },
    select: {
      slug: true,
      nombre: true,
      fecha_evento: true,
      lugar: true,
      configuracion_invitacion: true,
    },
  });

  if (!updated.configuracion_invitacion) {
    throw new Error("La configuración de la invitación no se guardó.");
  }

  console.log(
    `Invitación sincronizada: ${updated.nombre}, ${updated.fecha_evento.toISOString()}, ${updated.lugar}, slug /${updated.slug}.`,
  );
}

main()
  .catch((error) => {
    console.error("No se pudo sincronizar la invitación:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
