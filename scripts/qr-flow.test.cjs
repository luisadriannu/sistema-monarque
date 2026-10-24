// Ejecuta los handlers reales con una base de datos en memoria, sin tocar datos externos.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function loadSource(file, mocks, globals = {}) {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports, require: name => Object.hasOwn(mocks, name) ? mocks[name] : require(name),
    URL, Date, console, process, ...globals,
  }, { filename: file });
  return exports;
}

const nextServer = { NextResponse: { json: (data, init) => Response.json(data, init) } };
function fixture() {
  const organization = { id: "org-a", qr_checkin_habilitado: true };
  let user = { id: "organizer", rol: "organizador", organizacion_id: "org-a", organizacion: organization };
  const guest = { id: "guest-a", nombre: "Familia de prueba", grupo: "Amigos", codigo_entrada: "code-a", pases_asignados: 3, pases_confirmados: 2, pases_ingresados: 0, estado: "confirmado", evento: { id: "event-a", nombre: "Evento de prueba", usuario: { organizacion_id: "org-a" } } };
  const logs = [];
  const prisma = {
    organizacion: {
      findUnique: async () => organization,
      update: async ({ data }) => Object.assign(organization, data),
    },
    invitado: {
      findUnique: async ({ where }) => where.codigo_entrada === guest.codigo_entrada ? { ...guest } : null,
      update: async ({ data }) => {
        guest.pases_ingresados += data.pases_ingresados.increment;
        guest.ultima_entrada_en = data.ultima_entrada_en;
        return { ...guest };
      },
      count: async ({ where }) => guest.pases_ingresados > 0 && where.evento.usuario.organizacion_id === guest.evento.usuario.organizacion_id ? 1 : 0,
      findMany: async ({ where }) => guest.pases_ingresados > 0 && where.evento.usuario.organizacion_id === guest.evento.usuario.organizacion_id ? [{ ...guest }] : [],
    },
    registroEntrada: {
      create: async ({ data }) => { logs.push(data); return data; },
      findMany: async () => logs,
    },
    $transaction: async fn => fn(prisma),
  };
  const mocks = { "next/server": nextServer, "@/lib/auth": { getCurrentUser: async () => user }, "@/lib/prisma": prisma };
  return { organization, guest, logs, prisma, mocks, setUser: value => { user = value; } };
}

const request = (body, method = "POST") => new Request("http://localhost/api/entradas", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("El menú de una sesión abierta muestra y retira el escáner al cambiar premium", async () => {
  const states = [];
  const effects = [];
  const listeners = {};
  let cursor = 0;
  let premium = false;
  const react = {
    useState: initial => {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], value => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
    },
    useEffect: callback => effects.push(callback),
  };
  const nav = loadSource("components/DashboardNav.tsx", {
    react,
    "next/link": "a",
    "next/image": "img",
    "next/navigation": { usePathname: () => "/dashboard/usuarios" },
    "motion/react": { useReducedMotion: () => true, AnimatePresence: "div", motion: { span: "span", div: "div" } },
    "@/components/EventTypeIcon": "span",
  }, {
    document: { visibilityState: "visible", addEventListener: (name, callback) => { listeners[name] = callback; }, removeEventListener: () => {} },
    window: { setInterval: () => 1, clearInterval: () => {}, addEventListener: (name, callback) => { listeners[name] = callback; }, removeEventListener: () => {} },
    fetch: async () => Response.json({ user: { organizacion: { qr_checkin_habilitado: premium } } }),
  }).default;
  const render = () => {
    cursor = 0;
    return nav({ user: { rol: "organizador", nombre: "Prueba", email: "prueba@example.com" }, qrCheckinEnabled: false });
  };
  const contains = (node, text) => {
    if (node === text) return true;
    if (Array.isArray(node)) return node.some(child => contains(child, text));
    return node && typeof node === "object" ? Object.values(node.props || node).some(value => contains(value, text)) : false;
  };
  assert.equal(contains(render(), "Escanear invitación"), false);
  effects.splice(0).forEach(effect => effect());
  await listeners.focus();
  premium = true;
  await listeners.focus();
  assert.equal(contains(render(), "Escanear invitación"), true);
  premium = false;
  await listeners.visibilitychange();
  assert.equal(contains(render(), "Escanear invitación"), false);
});

test("Activar premium actualiza el permiso de una sesión existente sin reenviar datos de cuenta", async () => {
  const f = fixture();
  f.organization.qr_checkin_habilitado = false;
  f.setUser({ rol: "admin" });
  const organizerRoute = loadSource("app/api/organizadores/[id]/route.ts", f.mocks);
  const result = await organizerRoute.PATCH(request({ qr_checkin_habilitado: true }, "PATCH"), { params: Promise.resolve({ id: "org-a" }) });
  assert.equal(result.status, 200);
  f.setUser({ rol: "organizador", organizacion_id: "org-a", organizacion: f.organization });
  const me = loadSource("app/api/auth/me/route.ts", f.mocks);
  const response = await me.GET();
  assert.equal((await response.json()).user.organizacion.qr_checkin_habilitado, true);
  assert.match(response.headers.get("Cache-Control"), /no-store/);
});

test("Solo el administrador puede modificar premium y el valor debe ser booleano", async () => {
  const f = fixture();
  const route = loadSource("app/api/organizadores/[id]/route.ts", f.mocks);
  const context = { params: Promise.resolve({ id: "org-a" }) };
  assert.equal((await route.PATCH(request({ qr_checkin_habilitado: false }, "PATCH"), context)).status, 403);
  f.setUser({ rol: "admin" });
  assert.equal((await route.PATCH(request({ qr_checkin_habilitado: "false" }, "PATCH"), context)).status, 400);
  assert.equal(f.organization.qr_checkin_habilitado, true);
});

test("Escaneo, confirmación parcial y tabla de asistentes usan el mismo invitado", async () => {
  const f = fixture();
  const route = loadSource("app/api/entradas/route.ts", f.mocks);
  const lookup = await route.GET(new Request("http://localhost/api/entradas?codigo=monarque:entrada:code-a"));
  assert.equal((await lookup.json()).invitado.id, f.guest.id);
  const entry = await route.POST(request({ codigo: "monarque:entrada:code-a", cantidad: 1 }));
  assert.equal(entry.status, 200);
  assert.equal(f.logs[0].escaneado_por_id, "organizer");
  const second = await route.POST(request({ codigo: "code-a", cantidad: 1 }));
  assert.equal(second.status, 200);
  const table = await route.GET(new Request("http://localhost/api/entradas?page=1"));
  const data = await table.json();
  assert.equal(data.asistentes.length, 1);
  assert.equal(data.asistentes[0].pases_ingresados, 2);
  assert.equal(data.pagination.total, 1);
  assert.equal((await route.POST(request({ codigo: "code-a", cantidad: 1 }))).status, 409);
  assert.equal(f.logs.length, 2);
});

test("Sin premium, otro organizador y una clienta no pueden usar el lector", async () => {
  const f = fixture();
  const route = loadSource("app/api/entradas/route.ts", f.mocks);
  f.organization.qr_checkin_habilitado = false;
  assert.equal((await route.POST(request({ codigo: "code-a", cantidad: 1 }))).status, 403);
  f.organization.qr_checkin_habilitado = true;
  f.setUser({ rol: "organizador", organizacion_id: "org-b", organizacion: f.organization });
  assert.equal((await route.POST(request({ codigo: "code-a", cantidad: 1 }))).status, 404);
  assert.equal((await (await route.GET(new Request("http://localhost/api/entradas"))).json()).asistentes.length, 0);
  f.setUser({ rol: "clienta", organizacion_id: "org-a", organizacion: f.organization });
  assert.equal((await route.GET(new Request("http://localhost/api/entradas?codigo=code-a"))).status, 403);
  assert.equal(f.logs.length, 0);
});

test("Rechaza invitaciones declinadas y cantidades inválidas", async () => {
  const f = fixture();
  const route = loadSource("app/api/entradas/route.ts", f.mocks);
  for (const cantidad of [0, -1, 1.5, 4]) {
    const response = await route.POST(request({ codigo: "code-a", cantidad }));
    assert.ok([400, 409].includes(response.status));
  }
  f.guest.estado = "declinado";
  assert.equal((await route.POST(request({ codigo: "code-a", cantidad: 1 }))).status, 409);
  assert.equal((await route.POST(request({ cantidad: 1 }))).status, 400);
  assert.equal(f.logs.length, 0);
});

test("Invitación premium genera QR único en ambas plantillas, incluidos invitados anteriores", async () => {
  for (const slug of ["evento-generico", "boda-yazmin-y-cesar"]) {
    const f = fixture();
    const qrPayloads = [];
    f.prisma.evento = { findUnique: async () => ({ id: "event-a", slug, usuario_id: "client-a", nombre: "Prueba", anfitriones: "Ana y Luis", fecha_evento: new Date("2027-01-01"), fecha_limite_rsvp: new Date("2026-12-31"), usuario: { organizacion: f.organization } }) };
    f.prisma.invitado.findFirst = async ({ where }) => where.token === "token-a" ? { ...f.guest } : null;
    const generic = () => null;
    const vintage = () => null;
    const page = loadSource("app/[slug]/page.tsx", {
      ...f.mocks,
      "next/image": () => null,
      "@/app/templates/WeddingPersonalized": generic,
      "@/app/templates/WeddingOliveVintage": vintage,
      "@/app/data/carlosYYazmin": { event: {}, location: {}, media: {} },
      qrcode: { toDataURL: async payload => { qrPayloads.push(payload); return "data:image/png;base64,qr"; } },
    }).default;
    const render = (searchParams = { id: "token-a" }) => page({ params: Promise.resolve({ slug }), searchParams: Promise.resolve(searchParams) });
    const result = await render();
    assert.equal(result.props.children.type, slug === "evento-generico" ? generic : vintage);
    assert.equal(result.props.children.props.qrImage, "data:image/png;base64,qr");
    assert.equal(qrPayloads[0], "monarque:entrada:code-a");
    f.guest.codigo_entrada = "code-b";
    await render();
    assert.equal(qrPayloads[1], "monarque:entrada:code-b");
    f.organization.qr_checkin_habilitado = false;
    assert.equal((await render()).props.children.props.qrImage, null);
    f.organization.qr_checkin_habilitado = true;
    f.setUser({ rol: "admin" });
    assert.equal((await render({ preview: "1" })).props.children.props.qrImage, null);
  }
});
