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
    require: name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith("@/lib/") ? load(name.slice(2) + ".ts", mocks) : name.startsWith(".") ? load(path.join(path.dirname(file), name) + ".ts", mocks) : require(name),
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

test("Cupo de recepción: alta, restauración, edición y excepción del administrador", async () => {
  let used = 1, max = 1, writes = 0;
  let existing = { organizacion_id: "org-a", eliminado_en: new Date() };
  const prisma = {
    organizacion: { findUniqueOrThrow: async () => ({ max_recepcionistas: max }) },
    evento: { findMany: async () => [{ usuario: { organizacion_id: "org-a", lector_qr_habilitado: true, organizacion: organization } }] },
    eventoRecepcionista: { deleteMany: async () => {} },
    usuario: {
      count: async ({ where }) => { assert.equal(where.rol, "recepcionista"); assert.equal(where.eliminado_en, null); assert.equal(where.organizacion_id, "org-a"); return used; },
      findFirst: async () => ({ id: "staff" }), findUnique: async () => existing,
      create: async () => { writes++; used++; return { id: "staff" }; },
      update: async () => { writes++; return { id: "staff" }; },
    },
    $transaction: async function (operation, options) { assert.equal(options.isolationLevel, "Serializable"); return operation(this); },
  };
  const f = fixture(prisma, organizer);
  const create = f.route("app/api/recepcionistas/route.ts");
  const update = f.route("app/api/recepcionistas/[id]/route.ts");
  const body = { nombre: "Ana", email: "ana@example.com", password: "password1234", evento_ids: ["event"] };
  let response = await create.POST(request(body));
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "RECEPTION_CAPACITY_REACHED");
  assert.equal((await update.PUT(request(body), context("staff"))).status, 403);
  assert.equal(writes, 0);
  existing.eliminado_en = null;
  assert.equal((await update.PUT(request(body), context("staff"))).status, 200);
  used = 0;
  assert.equal((await create.POST(request(body))).status, 201);
  used = 0; existing.eliminado_en = new Date();
  assert.equal((await update.PUT(request(body), context("staff"))).status, 200);
  max = 0;
  assert.equal((await create.POST(request(body))).status, 403);
  f.setUser(admin);
  assert.equal((await create.POST(request(body))).status, 201);
});

test("Una colisión serializable vuelve a comprobar el último cupo de recepción", async () => {
  let attempts = 0, writes = 0;
  const prisma = {
    organizacion: { findUniqueOrThrow: async () => ({ max_recepcionistas: 1 }) },
    usuario: { count: async () => attempts === 1 ? 0 : 1 },
    $transaction: async function(operation) {
      attempts++;
      const value = await operation(this);
      if (attempts === 1) throw Object.assign(new Error("conflict"), { code: "P2034" });
      return value;
    },
  };
  const helper = fixture(prisma).route("lib/reception-capacity.ts");
  await assert.rejects(helper.withReceptionCapacity("org-a", false, undefined, async () => { writes++; }), /hasta 1 recepcionistas/);
  assert.equal(attempts, 2);
  assert.equal(writes, 1);
});

test("El administrador solo puede asignar cupos enteros no negativos", async () => {
  const f = fixture({ organizacion: { findUnique: async () => ({ plan: "pro", max_recepcionistas: 5 }) } });
  for (const file of ["app/api/organizadores/route.ts", "app/api/organizadores/[id]/route.ts"]) {
    const route = f.route(file);
    for (const value of [-1, 1.5, null, "5", 2147483648]) {
      const body = { nombre: "Ana", negocio: "Empresa", max_recepcionistas: value };
      const response = route.POST ? await route.POST(request(body)) : await route.PUT(request(body), context("org-a"));
      assert.equal(response.status, 400);
      assert.match((await response.json()).error, /cupo de recepcionistas/);
    }
  }
});

test("El listado muestra solo los activos como cupo usado y no limita al admin", async () => {
  const prisma = {
    usuario: { findMany: async () => [{ eliminado_en: null }, { eliminado_en: new Date() }] },
    evento: { findMany: async () => [] },
    organizacion: { findUniqueOrThrow: async () => ({ max_recepcionistas: 3 }) },
    $transaction: async operations => Promise.all(operations),
  };
  const f = fixture(prisma, organizer), route = f.route("app/api/recepcionistas/route.ts");
  assert.deepEqual((await (await route.GET()).json()).limites, { usados: 1, maximos: 3 });
  f.setUser(admin);
  assert.equal((await (await route.GET()).json()).limites, null);
});

test("Admin guarda el cupo personalizado y editar otros datos conserva ese cupo", async () => {
  let saved;
  const prisma = {
    organizacion: {
      create: async ({ data }) => { saved = data; return data; },
      findUnique: async () => ({ plan: "pro", max_recepcionistas: 7, servicio_vence_en: null }),
      update: async ({ data }) => { saved = data; return data; },
    },
    usuario: { findFirst: async () => ({ id: "owner" }), update: async () => ({}) },
    $transaction: async operations => Promise.all(operations),
  };
  const f = fixture(prisma);
  const body = { nombre: "Ana", negocio: "Empresa", email: "ana@example.com", password: "password1234", plan: "pro", max_recepcionistas: 3 };
  assert.equal((await f.route("app/api/organizadores/route.ts").POST(request(body))).status, 201);
  assert.equal(saved.max_recepcionistas, 3);
  const update = f.route("app/api/organizadores/[id]/route.ts");
  assert.equal((await update.PUT(request({ ...body, max_recepcionistas: 0 }), context("org-a"))).status, 200);
  assert.equal(saved.max_recepcionistas, 0);
  delete body.max_recepcionistas;
  assert.equal((await update.PUT(request(body), context("org-a"))).status, 200);
  assert.equal(saved.max_recepcionistas, 7);
});
