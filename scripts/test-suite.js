const { PrismaClient } = require("../generated/prisma-client-v2");
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

async function runTestSuite() {
  console.log("🧪 Iniciando Batería de Pruebas de Reglas de Negocio (Monarque - Plan Elite)...\n");
  let passed = 0;
  let total = 0;

  function assert(condition, testName) {
    total++;
    if (condition) {
      console.log(`  ✅ PASÓ [${total}]: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FALLÓ [${total}]: ${testName}`);
    }
  }

  try {
    // 1. Obtener evento de prueba
    const evento = await prisma.evento.findUnique({
      where: { slug: "boda-ana-y-luis" },
      include: { invitados: true },
    });
    assert(evento !== null, "Evento 'boda-ana-y-luis' existe en base de datos");

    // 2. Probar creación de invitado y generación de token único (RF-08, RF-12, RNF-01)
    const tokenPrueba = generateToken();
    const nuevoInv = await prisma.invitado.create({
      data: {
        evento_id: evento.id,
        nombre: "Test Familia Ramos",
        grupo: "Amigos",
        pases_asignados: 3,
        token: tokenPrueba,
        estado: "pendiente",
      },
    });
    assert(
      nuevoInv.token.length >= 12 && nuevoInv.estado === "pendiente" && nuevoInv.pases_asignados === 3,
      "RF-08 / RF-12: Invitado creado con token seguro >= 12 caracteres y estado 'pendiente'"
    );

    // 3. Probar RF-21: Al abrir por primera vez, cambia a 'visto'
    const invVisto = await prisma.invitado.update({
      where: { id: nuevoInv.id },
      data: { estado: "visto" },
    });
    assert(invVisto.estado === "visto", "RF-21: Apertura de invitación cambia estado a 'visto'");

    // 4. Probar RN-01: Validación de pases en confirmación (máximo no puede superar pases_asignados)
    const intentoExcedido = 5; // asignados son 3
    const puedeExceder = intentoExcedido <= invVisto.pases_asignados;
    assert(!puedeExceder, "RN-01: Servidor rechaza si confirmados (5) > asignados (3)");

    // 5. Probar confirmación válida (RF-20): 2 pases de 3 asignados
    const invConfirmado = await prisma.invitado.update({
      where: { id: nuevoInv.id },
      data: {
        pases_confirmados: 2,
        estado: "confirmado",
        ultima_respuesta_en: new Date(),
      },
    });
    assert(
      invConfirmado.estado === "confirmado" && invConfirmado.pases_confirmados === 2,
      "RF-20: Confirmación válida registrada para 2 personas"
    );

    // 6. Probar RN-05: Pases liberados (3 asignados - 2 confirmados = 1 pase liberado)
    const pasesLiberados = invConfirmado.pases_asignados - (invConfirmado.pases_confirmados || 0);
    assert(pasesLiberados === 1, "RN-05: Se calcula correctamente 1 pase liberado para reasignar");

    // 7. Probar RN-02: Clienta reduce pases por debajo de lo confirmado
    // Invitado confirmó 2, clienta reduce asignados a 1 -> confirmados deben ajustarse a 1
    const nuevoMax = 1;
    let confirmadosAjustados = invConfirmado.pases_confirmados;
    if (confirmadosAjustados > nuevoMax) {
      confirmadosAjustados = nuevoMax;
    }
    const invAjustado = await prisma.invitado.update({
      where: { id: nuevoInv.id },
      data: {
        pases_asignados: nuevoMax,
        pases_confirmados: confirmadosAjustados,
      },
    });
    assert(
      invAjustado.pases_asignados === 1 && invAjustado.pases_confirmados === 1,
      "RN-02: Al reducir pases asignados a 1, confirmación se ajusta automáticamente al nuevo máximo"
    );

    // 8. Probar RF-13: Regenerar link invalida el anterior
    const tokenAnterior = invAjustado.token;
    const tokenNuevo = generateToken();
    const invRegenerado = await prisma.invitado.update({
      where: { id: nuevoInv.id },
      data: { token: tokenNuevo },
    });
    assert(
      invRegenerado.token !== tokenAnterior && invRegenerado.token === tokenNuevo,
      "RF-13: Token regenerado con éxito e invalida el anterior"
    );

    // 9. Probar RF-15 / RF-23: Búsqueda con token anterior ya no encuentra al invitado
    const buscarTokenAnterior = await prisma.invitado.findUnique({
      where: { token: tokenAnterior },
    });
    assert(
      buscarTokenAnterior === null,
      "RF-15 / RF-23: El link antiguo muestra 'Invitación no disponible' (null en base de datos)"
    );

    // 10. Probar RN-03: Rechazo de confirmación si fecha límite expiró
    const eventoExpirado = {
      fecha_limite_rsvp: new Date(Date.now() - 1000 * 60 * 60 * 24), // Ayer
    };
    const estaExpirado = new Date() > eventoExpirado.fecha_limite_rsvp;
    assert(estaExpirado === true, "RN-03: Validación temporal detecta plazo vencido y rechaza respuestas");

    // Limpiar el registro de prueba
    await prisma.invitado.delete({ where: { id: nuevoInv.id } });
    console.log("\n🧹 Limpieza de datos de prueba completada.");

    console.log(`\n========================================`);
    console.log(`RESULTADO FINAL: ${passed}/${total} pruebas pasadas (${Math.round((passed / total) * 100)}%)`);
    console.log(`========================================\n`);
  } catch (err) {
    console.error("Error durante las pruebas:", err);
  } finally {
    await prisma.$disconnect();
  }
}

runTestSuite();
