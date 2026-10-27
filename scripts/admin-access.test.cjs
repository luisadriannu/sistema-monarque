// Pruebas de los handlers reales sin conectar a la base de datos del usuario.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, mocks, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports, URL, Date, console, ...globals,
    require: name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith("@/lib/") ? load(name.slice(2) + ".ts", mocks) : require(name),
  }, { filename: file });
  return exports;
}
const directId = "monarque-clientes-directos";
const organization = { id: "org-a", estado_servicio: "activo", qr_checkin_habilitado: true, max_clientes: 50, max_eventos_activos: 50 };
const admin = { id: "admin", rol: "admin", organizacion_id: null, organizacion: null };
const organizer = { id: "organizer", rol: "organizador", organizacion_id: "org-a", organizacion: organization };
const request = (body, method = "POST") => new Request("http://localhost/api/test", { method, body: JSON.stringify(body) });
const context = id => ({ params: Promise.resolve({ id }) });
const clientBody = { nombre: "Laura", email: "laura@example.com", password: "example-password", evento: {
  id: "event-b", nombre: "Boda Laura", anfitriones: "Laura y Miguel", slug: "boda-laura", lugar: "Salón", fecha_evento: "2099-01-01T18:00:00Z",
} };
function fixture(prisma, initial = admin, globals = {}) {
  let user = initial;
  const mocks = {
    "next/server": { NextResponse: { json: (data, init) => Response.json(data, init) } },
    "@/lib/prisma": prisma,
    "@/lib/auth": { getCurrentUser: async () => user },
    bcryptjs: { hash: async () => "hash" },
    "@/generated/prisma-client-v3": { Prisma: { PrismaClientKnownRequestError: class extends Error {} } },
    "@/lib/tokens": { generateInvitationToken: () => "token" },
  };
  return { route: file => load(file, mocks, globals), setUser: value => { user = value; } };
}

test("Admin crea una clienta directa sin organizador; el organizador no puede cambiar de organización", async () => {
  for (const user of [admin, organizer]) {
    const writes = [];
    let provisions = 0;
    const prisma = {
      usuario: { count: async () => 0, findUnique: async () => null, create: async ({ data }) => { writes.push(data); return { id: "client", ...data }; } },
      evento: { count: async () => 0, findUnique: async () => null, create: async ({ data }) => ({ id: "event", ...data }) },
      organizacion: { upsert: async ({ create }) => { provisions++; assert.equal(create.id, directId); assert.equal(create.qr_checkin_habilitado, true); return create; } },
    };
    prisma.$transaction = async operation => Array.isArray(operation) ? Promise.all(operation) : operation(prisma);
    const f = fixture(prisma, user);
    const response = await f.route("app/api/usuarios/route.ts").POST(request({ ...clientBody, organizacion_id: "org-foreign" }));
    assert.equal(response.status, 201);
    assert.equal((await response.json()).evento.modo_ingreso, "parcial");
    assert.equal(writes[0].rol, "clienta");
    assert.equal(writes[0].organizacion_id, user.rol === "admin" ? directId : "org-a");
    assert.equal(provisions, user.rol === "admin" ? 1 : 0);
  }
});

test("El listado global del admin incluye clientes directos y ajenos; el organizador solo ve los propios", async () => {
  const clients = ["org-a", "org-b", directId].map((id, index) => ({ id: String(index), rol: "clienta", organizacion_id: id, eliminado_en: null }));
  const f = fixture({ usuario: { findMany: async ({ where }) => clients.filter(client => !where.organizacion_id || client.organizacion_id === where.organizacion_id) } });
  const route = f.route("app/api/usuarios/route.ts");
  assert.equal((await (await route.GET()).json()).usuarios.length, 3);
  f.setUser(organizer);
  assert.equal((await (await route.GET()).json()).usuarios.length, 1);
  for (const rol of ["clienta", "recepcionista"]) {
    f.setUser({ ...organizer, rol });
    assert.equal((await route.GET()).status, 403);
    assert.equal((await route.POST(request(clientBody))).status, 403);
  }
});

test("Admin puede editar, mandar a papelera y restaurar clientes ajenos sin otorgar ese permiso al organizador", async () => {
  const client = { id: "client-b", rol: "clienta", organizacion_id: "org-b", nombre: "Laura", eliminado_en: null, eventos: [{ id: "event-b", configuracion_invitacion: {} }] };
  let writes = 0;
  const prisma = {
    usuario: {
      findUnique: async () => client,
      findFirst: async ({ where }) => !where.organizacion_id || where.organizacion_id === client.organizacion_id ? client : null,
      update: async ({ data }) => { writes++; return { ...client, ...data }; },
    },
    evento: { update: async () => { writes++; return {}; } },
    $transaction: async operations => Promise.all(operations),
  };
  const f = fixture(prisma, organizer);
  const route = f.route("app/api/usuarios/[id]/route.ts");
  for (const actor of [organizer, admin]) {
    f.setUser(actor);
    const expected = actor.rol === "admin" ? 200 : 404;
    assert.equal((await route.PUT(request(clientBody, "PUT"), context(client.id))).status, expected);
    assert.equal((await route.DELETE(request({}, "DELETE"), context(client.id))).status, expected);
    assert.equal((await route.PATCH(request({ action: "restaurar" }, "PATCH"), context(client.id))).status, expected);
    if (actor.rol !== "admin") assert.equal(writes, 0);
  }
  assert.equal(writes, 4);
});

test("Admin puede agregar, editar y eliminar invitados incluso en eventos finalizados de otra organización", async () => {
  let writes = 0;
  const event = { id: "event-b", usuario_id: "client-b", fecha_evento: new Date("2020-01-01"), usuario: { organizacion_id: "org-b", organizacion: { estado_servicio: "suspendido", max_invitados_evento: 1 } } };
  const guest = { id: "guest", nombre: "Ana", pases_asignados: 1, pases_ingresados: 0, estado: "pendiente", evento: event };
  const f = fixture({
    evento: { findUnique: async () => event },
    invitado: { findUnique: async () => guest, findMany: async () => [], count: async () => 1,
      create: async () => { writes++; return guest; }, update: async () => { writes++; return guest; }, delete: async () => { writes++; return guest; } },
  });
  const list = f.route("app/api/invitados/route.ts");
  const one = f.route("app/api/invitados/[id]/route.ts");
  assert.equal((await (await list.GET(new Request("http://localhost/api/invitados?evento_id=event-b"))).json()).solo_lectura, false);
  assert.equal((await list.POST(request({ evento_id: "event-b", nombre: "Ana", pases_asignados: 1 }))).status, 200);
  assert.equal((await one.PUT(request({ nombre: "Ana María" }, "PUT"), context("guest"))).status, 200);
  assert.equal((await one.DELETE(request({}, "DELETE"), context("guest"))).status, 200);
  f.setUser(organizer);
  assert.equal((await one.DELETE(request({}, "DELETE"), context("guest"))).status, 403);
  assert.equal(writes, 3);
});

test("Admin crea recepción para eventos directos; no se mezclan organizaciones ni se amplía el acceso del organizador", async () => {
  const events = [{ id: "direct-event", usuario: { organizacion_id: directId } }, { id: "foreign-event", usuario: { organizacion_id: "org-b" } }];
  const writes = [];
  const f = fixture({
    evento: { findMany: async ({ where }) => events.filter(event => where.id.in.includes(event.id) && (!where.usuario.organizacion_id || where.usuario.organizacion_id === event.usuario.organizacion_id)) },
    usuario: { create: async ({ data }) => { writes.push(data); return { id: "staff", nombre: data.nombre }; } },
  });
  const route = f.route("app/api/recepcionistas/route.ts");
  const staffBody = { nombre: "Ana", email: "staff@example.com", password: "example-password", evento_ids: ["direct-event"], rol: "admin", organizacion_id: "org-a" };
  assert.equal((await route.POST(request(staffBody))).status, 201);
  assert.equal(writes[0].rol, "recepcionista");
  assert.equal(writes[0].organizacion_id, directId);
  assert.equal(writes[0].eventos_recepcion.create.length, 1);
  assert.equal((await route.POST(request({ ...staffBody, evento_ids: ["direct-event", "foreign-event"] }))).status, 403);
  f.setUser(organizer);
  assert.equal((await route.POST(request(staffBody))).status, 403);
  f.setUser({ ...organizer, rol: "recepcionista" });
  assert.equal((await route.POST(request(staffBody))).status, 403);
  assert.equal(writes.length, 1);
});

test("Admin puede desactivar recepción ajena; otros organizadores y recepcionistas no", async () => {
  let writes = 0;
  const f = fixture({ usuario: {
    findFirst: async ({ where }) => !where.organizacion_id || where.organizacion_id === "org-b" ? { id: "staff", nombre: "Ana" } : null,
    update: async ({ data }) => { writes++; assert.equal(data.lector_qr_habilitado, false); assert.equal(data.session_version.increment, 1); return {}; },
  } });
  const route = f.route("app/api/recepcionistas/[id]/route.ts");
  assert.equal((await route.DELETE(request({}, "DELETE"), context("staff"))).status, 200);
  f.setUser(organizer);
  assert.equal((await route.DELETE(request({}, "DELETE"), context("staff"))).status, 404);
  f.setUser({ ...organizer, rol: "recepcionista" });
  assert.equal((await route.DELETE(request({}, "DELETE"), context("staff"))).status, 403);
  assert.equal(writes, 1);
});

test("El escáner permite al admin cualquier evento y al recepcionista solo su evento asignado", async () => {
  const event = { id: "event-b", nombre: "Evento", estado: "recepcion_abierta", modo_ingreso: "unico", usuario: { organizacion_id: "org-b" } };
  const guest = { id: "guest", evento: event, pases_confirmados: 2, pases_ingresados: 0, estado: "confirmado", escaneado_en: null };
  const prisma = {
    evento: { findFirst: async ({ where }) => {
      if (where.usuario && where.usuario.organizacion_id !== "org-b") return null;
      if (where.recepcionistas && where.recepcionistas.some.usuario_id !== "assigned-staff") return null;
      return event;
    } },
    invitado: { findUnique: async () => guest, update: async ({ data }) => ({ ...guest, pases_ingresados: data.pases_ingresados.increment }) },
    registroEntrada: { create: async () => ({}) },
  };
  prisma.$transaction = async operation => operation(prisma);
  const f = fixture(prisma);
  const route = f.route("app/api/entradas/route.ts");
  const entry = { codigo: "code", evento_id: "event-b", cantidad: 2 };
  assert.equal((await route.POST(request(entry))).status, 200);
  f.setUser(organizer);
  assert.equal((await route.POST(request(entry))).status, 403);
  const staff = { ...organizer, organizacion_id: "org-b", rol: "recepcionista", lector_qr_habilitado: true };
  f.setUser({ ...staff, id: "unassigned-staff" });
  assert.equal((await route.POST(request(entry))).status, 403);
  f.setUser({ ...staff, id: "assigned-staff" });
  assert.equal((await route.POST(request(entry))).status, 200);
});

test("Admin puede reasignar y restaurar recepción; un organizador ajeno no puede editarla", async () => {
  let updated, removedAssignments = 0;
  const prisma = {
    usuario: {
      findFirst: async ({ where }) => !where.organizacion_id || where.organizacion_id === "org-b" ? { id: "staff" } : null,
      update: async ({ data }) => { updated = data; return { id: "staff" }; },
    },
    evento: { findMany: async () => [{ usuario: { organizacion_id: directId } }] },
    eventoRecepcionista: { deleteMany: async () => { removedAssignments++; } },
  };
  prisma.$transaction = async operation => operation(prisma);
  const f = fixture(prisma, organizer);
  const route = f.route("app/api/recepcionistas/[id]/route.ts");
  const body = { nombre: "Ana", email: "ana@example.com", evento_ids: ["direct-event"] };
  assert.equal((await route.PUT(request(body, "PUT"), context("staff"))).status, 404);
  assert.equal(removedAssignments, 0);
  f.setUser(admin);
  assert.equal((await route.PUT(request(body, "PUT"), context("staff"))).status, 200);
  assert.equal(updated.organizacion_id, directId);
  assert.equal(updated.session_version.increment, 1);
  assert.equal(updated.eliminado_en, null);
  assert.equal(updated.eventos_recepcion.create[0].evento_id, "direct-event");
});

test("Admin configura y abre recepción de eventos ajenos, y puede corregir sus entradas", async () => {
  const event = { id: "event-b", usuario_id: "client-b", nombre: "Evento", estado: "publicado", fecha_evento: new Date("2020-01-01"), fecha_limite_rsvp: new Date("2020-01-01") };
  const writes = [];
  const prisma = {
    evento: {
      findUnique: async () => event,
      findMany: async ({ where }) => where.id === event.id && (!where.usuario_id || where.usuario_id === event.usuario_id) ? [event] : [],
      findFirst: async ({ where }) => !where.usuario.organizacion_id ? event : null,
      update: async ({ data }) => { writes.push(data); return { ...event, ...data }; },
    },
    invitado: {
      findFirst: async ({ where }) => !where.evento.usuario.organizacion_id ? { id: "guest", nombre: "Ana" } : null,
      update: async ({ data }) => { writes.push(data); return {}; },
    },
    registroEntrada: { deleteMany: async () => ({ count: 1 }) },
    $transaction: async operations => Promise.all(operations),
  };
  const f = fixture(prisma);
  const config = f.route("app/api/eventos/route.ts");
  const data = await (await config.GET(new Request("http://localhost/api/eventos?evento_id=event-b"))).json();
  assert.equal(data.eventos[0].id, "event-b");
  assert.equal(data.permisos.administrador, true);
  assert.equal((await config.PUT(request({ id: "event-b", modo_ingreso: "parcial" }, "PUT"))).status, 200);
  const reception = f.route("app/api/eventos/[id]/recepcion/route.ts");
  assert.equal((await reception.PATCH(request({ action: "abrir" }, "PATCH"), context("event-b"))).status, 200);
  const entry = f.route("app/api/entradas/[id]/route.ts");
  assert.equal((await entry.DELETE(request({}, "DELETE"), context("guest"))).status, 200);
  assert.equal(writes.at(-1).pases_ingresados, 0);
  f.setUser(organizer);
  assert.equal((await config.PUT(request({ id: "event-b", modo_ingreso: "parcial" }, "PUT"))).status, 403);
  assert.equal((await reception.PATCH(request({ action: "abrir" }, "PATCH"), context("event-b"))).status, 404);
  assert.equal((await entry.DELETE(request({}, "DELETE"), context("guest"))).status, 404);
  assert.equal(writes.length, 3);
});

test("El grupo interno de clientes directos no se puede borrar ni suspender como organizador comercial", async () => {
  const f = fixture({});
  const route = f.route("app/api/organizadores/[id]/route.ts");
  assert.equal((await route.DELETE(request({}, "DELETE"), context(directId))).status, 400);
  assert.equal((await route.PUT(request({}, "PUT"), context(directId))).status, 400);
  assert.equal((await route.PATCH(request({ qr_checkin_habilitado: false }, "PATCH"), context(directId))).status, 400);
});

test("La clienta guarda QR múltiple y solo puede programar nuevos horarios futuros", async () => {
  const now = Date.now();
  const event = { id: "event", usuario_id: "client", fecha_evento: new Date("2099-01-01"), fecha_limite_rsvp: new Date("2099-01-01"), recepcion_abre_en: null, recepcion_cierra_en: null };
  const writes = [];
  const f = fixture({ evento: {
    findUnique: async () => event,
    update: async ({ data }) => { writes.push(data); return { ...event, ...data }; },
  } }, { ...organizer, id: "client", rol: "clienta" });
  const route = f.route("app/api/eventos/route.ts");
  const save = body => route.PUT(request({ id: "event", ...body }, "PUT"));
  for (const field of ["recepcion_abre_en", "recepcion_cierra_en"]) {
    const response = await save({ [field]: new Date(now - 60000).toISOString() });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, "RECEPTION_DATE_PAST");
  }
  assert.equal(writes.length, 0);
  const opening = new Date(now + 3600000);
  const closing = new Date(now + 7200000);
  assert.equal((await save({ recepcion_abre_en: opening.toISOString(), recepcion_cierra_en: closing.toISOString(), modo_ingreso: "unico" })).status, 200);
  assert.equal(writes[0].modo_ingreso, "parcial");
  // También compara con el horario almacenado si solo se envía un extremo.
  event.recepcion_abre_en = opening;
  assert.equal((await save({ recepcion_cierra_en: new Date(now + 1800000).toISOString() })).status, 400);
  // Una apertura histórica sin cambios no impide actualizar otros ajustes.
  event.recepcion_abre_en = new Date(Math.floor((now - 3600000) / 60000) * 60000);
  assert.equal((await save({ recepcion_abre_en: event.recepcion_abre_en.toISOString(), capacidad_total: 150 })).status, 200);
  assert.equal((await save({ recepcion_abre_en: new Date(now - 1800000).toISOString() })).status, 400);
});

test("La fecha límite acepta hoy en México y días futuros hasta el evento, pero rechaza cambios a días antiguos", async () => {
  // En UTC ya es día 20; en Ciudad de México todavía es día 19.
  const fixedNow = new Date("2090-05-20T03:00:00Z").getTime();
  class FixedDate extends Date {
    constructor(value) { super(value === undefined ? fixedNow : value); }
    static now() { return fixedNow; }
  }
  let writes = 0;
  const event = { id: "event", usuario_id: "client", fecha_evento: new Date("2099-01-01T18:00:00Z"), fecha_limite_rsvp: new Date("2080-01-01T23:59:59-06:00") };
  const f = fixture({ evento: {
    findUnique: async () => event,
    update: async ({ data }) => { writes++; return { ...event, ...data }; },
  } }, { ...organizer, id: "client", rol: "clienta" }, { Date: FixedDate });
  const route = f.route("app/api/eventos/route.ts");
  const save = deadline => route.PUT(request({ id: "event", fecha_limite_rsvp: deadline }, "PUT"));
  for (const date of ["1980-01-01T23:59:59-06:00", "2090-05-18T23:59:59-06:00"]) {
    const response = await save(date);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, "RSVP_DATE_PAST");
  }
  assert.equal(writes, 0);
  for (const date of [null, "", "fecha inválida", "2099-01-02T23:59:59-06:00"]) assert.equal((await save(date)).status, 400);
  assert.equal((await save("2090-05-19T23:59:59-06:00")).status, 200);
  assert.equal((await save("2090-05-25T23:59:59-06:00")).status, 200);
  // Un valor histórico sin modificar puede conservarse para cambios administrativos.
  assert.equal((await save(event.fecha_limite_rsvp.toISOString())).status, 200);
});
