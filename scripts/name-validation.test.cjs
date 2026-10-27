const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, mocks = {}, globals = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, { exports, URL, Date, console, ...globals,
    require: name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith("@/lib/") ? load(name.slice(2) + ".ts", mocks) : require(name),
  });
  return exports;
}

test("Los nombres permiten letras internacionales, acentos y espacios; rechazan números y símbolos", () => {
  const { isValidName, lettersOnly } = load("lib/names.ts");
  for (const name of ["María José Muñoz", "Familia Gómez Pérez", "Jose\u0301", "李 明"]) assert.equal(isValidName(name), true, name);
  for (const name of ["Ana123", "123", "Ana １２", "Luis!", "Dra. Ana", "   ", "", null]) assert.equal(isValidName(name), false, String(name));
  assert.equal(lettersOnly("María 123 Muñoz!"), "María  Muñoz");
});

test("Crear clienta rechaza días y horas pasadas antes de crear la cuenta o consultar cupos", async () => {
  const now = new Date("2026-10-27T18:00:00Z"); // Mediodía en Ciudad de México.
  class FixedDate extends Date { static now() { return now.getTime(); } }
  const route = load("app/api/usuarios/route.ts", {
    "next/server": { NextResponse: { json: (data, init) => Response.json(data, init) } },
    bcryptjs: {},
    "@/generated/prisma-client-v3": { Prisma: {} },
    // No debe acceder a la base de datos con una fecha inválida o pasada.
    "@/lib/prisma": {},
    "@/lib/auth": { getCurrentUser: async () => ({ rol: "organizador", organizacion_id: "org", organizacion: {} }) },
    "@/lib/utils": {},
    "@/lib/event-theme": {},
    "@/lib/organization-access": { isOrganizationServiceActive: () => true },
  }, { Date: FixedDate });
  for (const fecha_evento of ["2026-10-26T12:00:00-06:00", "2026-10-27T11:59:00-06:00", "2026-10-27T12:00:00-06:00", "fecha inválida", ""]) {
    const response = await route.POST(new Request("http://localhost/api/usuarios", { method: "POST", body: JSON.stringify({
      nombre: "Laura", email: "laura@example.com", password: "example-password", evento: {
        nombre: "Boda Laura", anfitriones: "Laura y Miguel", slug: "boda-laura", lugar: "Salón", fecha_evento,
      },
    }) }));
    assert.equal(response.status, 400, fecha_evento);
    const data = await response.json();
    if (fecha_evento.includes("2026")) assert.equal(data.code, "EVENT_DATE_PAST");
    else assert.match(data.error, /fecha.*no es válida/);
  }
});

test("Crear, editar e importar invitados con números se rechaza antes de escribir datos", async () => {
  let writes = 0;
  const guest = { id: "guest", evento: { usuario_id: "client", usuario: { organizacion_id: "org" } } };
  const mocks = {
    "next/server": { NextResponse: { json: (data, init) => Response.json(data, init) } },
    "@/lib/auth": { getCurrentUser: async () => ({ id: "client", rol: "clienta" }) },
    "@/lib/prisma": {
      evento: { findUnique: async () => ({ id: "event", usuario_id: "client", usuario: {} }) },
      invitado: { findUnique: async () => guest, count: async () => 0, create: async () => { writes++; }, update: async () => { writes++; } },
    },
    "@/lib/tokens": { generateInvitationToken: () => "token" },
    "@/lib/utils": { isEventFinished: () => false },
    "@/lib/organization-access": {},
  };
  const create = load("app/api/invitados/route.ts", mocks);
  const edit = load("app/api/invitados/[id]/route.ts", mocks);
  const request = (body, method = "POST") => new Request("http://localhost/api/invitados", { method, body: JSON.stringify(body) });
  assert.equal((await create.POST(request({ evento_id: "event", nombre: "Ana123", pases_asignados: 2 }))).status, 400);
  assert.equal((await edit.PUT(request({ nombre: "Ana123" }, "PUT"), { params: Promise.resolve({ id: "guest" }) })).status, 400);
  // Ni siquiera la primera fila válida se inserta si otra fila tiene un nombre inválido.
  const response = await create.POST(request({ evento_id: "event", bulk: true, invitados: [{ nombre: "Ana", pases: 1 }, { nombre: "Luis2", pases: 1 }] }));
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Invitado 2/);
  assert.equal(writes, 0);
});

test("Crear clienta resuelve enlaces ocupados, distingue correos y reintenta colisiones simultáneas", async () => {
  class KnownError extends Error {
    constructor(target) { super("Duplicado"); this.code = "P2002"; this.meta = { target: [target] }; }
  }
  for (const scenario of ["libre", "ocupado", "correo", "carrera", "correo-en-carrera"]) {
    const occupied = new Set(scenario === "ocupado" ? ["boda-laura", "boda-laura-2"] : []);
    const committed = [];
    let attempts = 0;
    const prisma = {
      usuario: { count: async () => 0, findUnique: async () => scenario === "correo" ? { id: "existing" } : null },
      evento: { count: async () => 0, findUnique: async ({ where }) => occupied.has(where.slug) ? { id: "existing" } : null },
      $transaction: async operation => {
        if (Array.isArray(operation)) return Promise.all(operation);
        attempts++;
        const tx = {
          usuario: { create: async () => {
            if (scenario === "correo-en-carrera") throw new KnownError("email");
            return { id: "client", nombre: "Laura" };
          } },
          evento: { create: async ({ data }) => {
            if (scenario === "carrera" && attempts === 1) { occupied.add(data.slug); throw new KnownError("slug"); }
            return { id: "event", nombre: data.nombre, slug: data.slug };
          } },
        };
        const result = await operation(tx);
        committed.push(result);
        return result;
      },
    };
    const route = load("app/api/usuarios/route.ts", {
      "next/server": { NextResponse: { json: (data, init) => Response.json(data, init) } },
      bcryptjs: { hash: async () => "hash" },
      "@/generated/prisma-client-v3": { Prisma: { PrismaClientKnownRequestError: KnownError } },
      "@/lib/prisma": prisma,
      "@/lib/auth": { getCurrentUser: async () => ({ rol: "organizador", organizacion_id: "org", organizacion: { max_clientes: 100, max_eventos_activos: 100 } }) },
      "@/lib/utils": { toDateInputValue: () => "2027-01-01", endOfDayMexicoDate: () => new Date("2027-01-01") },
      "@/lib/event-theme": { normalizeEventType: () => "boda", eventTypeThemes: { boda: {} }, genericInvitationTheme: {} },
      "@/lib/organization-access": { isOrganizationServiceActive: () => true },
    });
    const response = await route.POST(new Request("http://localhost/api/usuarios", { method: "POST", body: JSON.stringify({
      nombre: "Laura", email: "laura@example.com", password: "example-password", evento: {
        nombre: "Boda Laura", anfitriones: "Laura y Miguel", slug: "boda-laura", lugar: "Salón", fecha_evento: "2027-01-01T18:00:00Z",
      },
    }) }));
    const data = await response.json();
    if (scenario.startsWith("correo")) {
      assert.equal(response.status, 409);
      assert.equal(data.code, "EMAIL_TAKEN");
      assert.equal(committed.length, 0);
    } else {
      assert.equal(response.status, 201);
      assert.equal(committed.length, 1);
      assert.equal(data.evento.slug, scenario === "ocupado" ? "boda-laura-3" : scenario === "carrera" ? "boda-laura-2" : "boda-laura");
      if (scenario !== "libre") assert.match(data.message, /ya está registrado.*automáticamente/);
      else assert.equal(data.message, undefined);
    }
  }
});
