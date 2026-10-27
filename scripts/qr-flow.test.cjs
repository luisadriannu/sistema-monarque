// Ejecuta los handlers reales con una base de datos en memoria, sin tocar datos externos.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function loadSource(file, mocks, globals = {}) {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports, require: name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith("@/lib/") ? loadSource(name.slice(2) + ".ts", mocks) : require(name),
    URL, Date, console, process, ...globals,
  }, { filename: file });
  return exports;
}

const nextServer = { NextResponse: { json: (data, init) => Response.json(data, init) } };
function fixture() {
  const organization = { id: "org-a", plan: "elite", qr_checkin_habilitado: true, estado_servicio: "activo", servicio_vence_en: null, eliminado_en: null };
  let user = { id: "organizer", rol: "organizador", organizacion_id: "org-a", organizacion: organization };
  const event = { id: "event-a", nombre: "Evento de prueba", anfitriones: "Ana y Luis", fecha_evento: new Date("2027-01-01"), lugar: "Salón", estado: "recepcion_abierta", modo_ingreso: "unico", recepcion_abre_en: null, recepcion_cierra_en: null, usuario: { organizacion_id: "org-a" } };
  const guest = { id: "guest-a", nombre: "Familia de prueba", grupo: "Amigos", codigo_entrada: "code-a", pases_asignados: 3, pases_confirmados: 2, pases_ingresados: 0, ultima_entrada_en: null, escaneado_en: null, estado: "confirmado", evento: event };
  const logs = [];
  const prisma = {
    organizacion: {
      findUnique: async () => organization,
      update: async ({ data }) => Object.assign(organization, data),
    },
    evento: {
      findFirst: async ({ where }) => where.id === event.id && (user.rol !== "recepcionista" || where.recepcionistas) && user.organizacion_id === "org-a" ? { ...event } : null,
      findMany: async () => [{ ...event }],
    },
    invitado: {
      findUnique: async ({ where }) => where.codigo_entrada === guest.codigo_entrada ? { ...guest } : null,
      update: async ({ data }) => {
        guest.pases_ingresados += data.pases_ingresados.increment;
        guest.ultima_entrada_en = data.ultima_entrada_en;
        guest.escaneado_en = data.escaneado_en;
        return { ...guest };
      },
      count: async ({ where }) => guest.pases_ingresados > 0 && where.evento_id === guest.evento.id ? 1 : 0,
      findMany: async ({ where }) => guest.pases_ingresados > 0 && where.evento_id === guest.evento.id ? [{ ...guest }] : [],
    },
    registroEntrada: {
      create: async ({ data }) => { logs.push(data); return data; },
      findMany: async () => logs,
    },
    $transaction: async fn => fn(prisma),
  };
  const mocks = {
    "next/server": nextServer,
    "@/lib/auth": { getCurrentUser: async () => user },
    "@/lib/prisma": prisma,
    "@/lib/organization-access": {
      isOrganizationServiceActive: organization => organization?.estado_servicio === "activo" && !organization?.eliminado_en,
      organizationBlockMessage: () => "Servicio no disponible.",
      normalizePlan: value => ["basico", "pro", "elite"].includes(value) ? value : "basico",
      planPresets: { basico: { qr: false }, pro: { qr: true }, elite: { qr: true } },
    },
  };
  return { organization, event, guest, logs, prisma, mocks, setUser: value => { user = value; } };
}

const request = (body, method = "POST") => new Request("http://localhost/api/entradas", {
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body && typeof body === "object" ? { evento_id: "event-a", ...body } : body),
});

test("Regenerar enlace reinicia la respuesta y el envío, invalida las credenciales y conserva los ingresos", async () => {
  for (const estado of ["pendiente", "visto", "confirmado", "declinado"]) {
    const f = fixture();
    const scannedAt = new Date("2026-10-23T20:00:00Z");
    Object.assign(f.guest, { token: "token-anterior", estado, pases_ingresados: 2, ninos_confirmados: 1,
      ultima_entrada_en: scannedAt, escaneado_en: scannedAt, escaneado_por: "organizer",
      ultima_respuesta_en: scannedAt, enviado_en: scannedAt });
    f.guest.evento.usuario.organizacion = f.organization;
    f.prisma.invitado.findUnique = async ({ where }) =>
      where.id === f.guest.id || where.token === f.guest.token || where.codigo_entrada === f.guest.codigo_entrada ? { ...f.guest } : null;
    f.prisma.invitado.update = async ({ data }) => Object.assign(f.guest, data);
    f.setUser({ id: "client", rol: "clienta" });
    f.event.usuario_id = "client";
    const mocks = { ...f.mocks,
      "@/lib/utils": { isEventFinished: () => false },
      "@/lib/tokens": { generateInvitationToken: size => size ? "qr-nuevo" : "token-nuevo" },
    };
    const edit = loadSource("app/api/invitados/[id]/route.ts", mocks);
    const response = await edit.PUT(request({ action: "regenerar_link" }, "PUT"), { params: Promise.resolve({ id: f.guest.id }) });
    assert.equal(response.status, 200);
    assert.equal(f.guest.estado, "pendiente");
    assert.equal(f.guest.pases_confirmados, null);
    assert.equal(f.guest.ninos_confirmados, 0);
    assert.equal(f.guest.ultima_respuesta_en, null);
    assert.equal(f.guest.enviado_en, null);
    assert.equal(f.guest.token, "token-nuevo");
    assert.equal(f.guest.codigo_entrada, "qr-nuevo");
    assert.equal(f.guest.escaneado_en, null);
    assert.equal(f.guest.pases_asignados, 3);
    assert.equal(f.guest.pases_ingresados, 2);
    assert.equal(f.guest.ultima_entrada_en, scannedAt);
    const qr = loadSource("app/api/invitacion/entrada/route.ts", { ...mocks,
      "@/lib/ratelimit": { checkRateLimit: () => true },
      qrcode: { toDataURL: async () => { throw new Error("No debe generar QR sin confirmar"); } },
    });
    assert.equal((await qr.GET(new Request("http://localhost/api/invitacion/entrada?token=token-anterior"))).status, 404);
    const pass = await (await qr.GET(new Request("http://localhost/api/invitacion/entrada?token=token-nuevo&qr=1"))).json();
    assert.equal(pass.confirmado, false);
    assert.equal(pass.qrImage, undefined);
  }
});

test("La clienta amplía de 10 a 15 después del ingreso y el nuevo QR suma solo 5", async () => {
  const f = fixture();
  Object.assign(f.guest, { pases_asignados: 10, pases_confirmados: 10, ninos_confirmados: 2 });
  f.event.usuario_id = "client-a";
  f.event.usuario.organizacion = f.organization;
  f.prisma.invitado.findUnique = async ({ where }) =>
    where.id === f.guest.id || where.codigo_entrada === f.guest.codigo_entrada || where.token === "token-a" ? { ...f.guest } : null;
  f.prisma.invitado.update = async ({ data }) => {
    const { pases_ingresados, ...rest } = data;
    Object.assign(f.guest, rest);
    if (pases_ingresados) f.guest.pases_ingresados += pases_ingresados.increment;
    return { ...f.guest };
  };
  f.prisma.evento.findUnique = async () => f.event;
  const mocks = { ...f.mocks,
    "@/lib/tokens": { generateInvitationToken: () => "code-renovado" },
    "@/lib/utils": { isEventFinished: () => false },
  };
  const scan = loadSource("app/api/entradas/route.ts", mocks);
  assert.equal((await scan.POST(request({ codigo: "code-a", cantidad: 10 }))).status, 200);
  const firstEntry = f.guest.ultima_entrada_en;
  f.setUser({ id: "client-a", rol: "clienta", organizacion: f.organization });
  const edit = loadSource("app/api/invitados/[id]/route.ts", mocks);
  const edited = await edit.PUT(request({ pases_asignados: 15 }, "PUT"), { params: Promise.resolve({ id: f.guest.id }) });
  assert.equal(edited.status, 200);
  assert.equal(f.guest.pases_confirmados, 15);
  assert.equal(f.guest.pases_ingresados, 10);
  assert.equal(f.guest.ninos_confirmados, 2);
  assert.equal(f.guest.ultima_entrada_en, firstEntry);
  assert.equal(f.guest.escaneado_en, null);
  const guests = loadSource("app/api/invitados/route.ts", mocks);
  const kpis = async () => (await (await guests.GET(new Request("http://localhost/api/invitados?evento_id=event-a"))).json()).kpis;
  assert.equal((await kpis()).total_ingresados, 10);
  assert.equal((await kpis()).confirmados_pendientes_ingreso, 5);
  const qr = loadSource("app/api/invitacion/entrada/route.ts", { ...mocks,
    "@/lib/ratelimit": { checkRateLimit: () => true },
    qrcode: { toDataURL: async payload => { assert.equal(payload, "monarque:entrada:code-renovado"); return "data:image/png;base64,nuevo"; } },
  });
  assert.equal((await (await qr.GET(new Request("http://localhost/api/invitacion/entrada?token=token-a&qr=1"))).json()).qrImage, "data:image/png;base64,nuevo");
  f.setUser({ id: "organizer", rol: "organizador", organizacion_id: "org-a", organizacion: f.organization });
  assert.equal((await scan.POST(request({ codigo: "code-a", cantidad: 5 }))).status, 404);
  const additional = await scan.POST(request({ codigo: "code-renovado", cantidad: 5 }));
  assert.equal(additional.status, 200);
  assert.equal((await additional.json()).invitado.pases_ingresados, 15);
  assert.equal((await scan.POST(request({ codigo: "code-renovado", cantidad: 5 }))).status, 409);
  assert.deepEqual(f.logs.map(log => log.cantidad), [10, 5]);
  const totals = await kpis();
  assert.equal(totals.total_ingresados, 15);
  assert.equal(totals.confirmados_pendientes_ingreso, 0);
  assert.equal(totals.familias_ingresadas, 1);
  // Cambiar la respuesta después no borra personas que ya llegaron.
  f.guest.pases_confirmados = 8;
  assert.equal((await kpis()).total_ingresados, 15);
  f.guest.estado = "declinado";
  assert.equal((await kpis()).total_ingresados, 15);
  assert.equal((await kpis()).familias_ingresadas, 1);
});

test("Ampliar cupo antes del ingreso conserva la confirmación y después suma solo el incremento", async () => {
  for (const entered of [0, 8]) {
    const f = fixture();
    Object.assign(f.guest, { pases_asignados: 10, pases_confirmados: 8, pases_ingresados: entered, ninos_confirmados: 2 });
    f.prisma.invitado.findUnique = async () => ({ ...f.guest });
    f.prisma.invitado.update = async ({ data }) => Object.assign(f.guest, data);
    const edit = loadSource("app/api/invitados/[id]/route.ts", { ...f.mocks,
      "@/lib/tokens": { generateInvitationToken: () => "nuevo" },
      "@/lib/utils": { isEventFinished: () => false },
    });
    assert.equal((await edit.PUT(request({ pases_asignados: 15 }, "PUT"), { params: Promise.resolve({ id: f.guest.id }) })).status, 200);
    assert.equal(f.guest.pases_confirmados, entered ? 13 : 8);
    assert.equal(f.guest.pases_ingresados, entered);
  }
});

test("La asistencia solo se actualiza al pulsar el botón, sin intervalos ni eventos de foco", () => {
  let refreshes = 0, pending = false;
  const component = loadSource("components/AttendanceRefresh.tsx", {
    react: { useTransition: () => [pending, fn => fn()] },
    "next/navigation": { useRouter: () => ({ refresh: () => refreshes++ }) },
  }, {
    window: { setInterval: () => assert.fail("No debe programar consultas"), addEventListener: () => assert.fail("No debe escuchar el foco") },
    document: { addEventListener: () => assert.fail("No debe escuchar la visibilidad") },
  }).default;
  const button = component();
  assert.equal(refreshes, 0);
  assert.equal(button.props.disabled, false);
  button.props.onClick();
  assert.equal(refreshes, 1);
  pending = true;
  assert.equal(component().props.disabled, true);
});

test("El menú actualiza permisos al navegar sin suscribirse al foco ni a la visibilidad", async () => {
  const states = [];
  const effects = [];
  const listeners = {};
  let cursor = 0;
  let premium = false;
  let pathname = "/dashboard/usuarios";
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
    "@/components/LoadingLink": "a",
    "next/image": "img",
    "next/navigation": { usePathname: () => pathname },
    "motion/react": { useReducedMotion: () => true, AnimatePresence: "div", motion: { span: "span", div: "div" } },
    "@/components/EventTypeIcon": "span",
  }, {
    document: { visibilityState: "visible", addEventListener: (name, callback) => { listeners[name] = callback; }, removeEventListener: () => {} },
    window: { addEventListener: (name, callback) => { listeners[name] = callback; }, removeEventListener: () => {} },
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
  await new Promise(setImmediate);
  assert.equal(listeners.focus, undefined);
  assert.equal(listeners.visibilitychange, undefined);
  premium = true;
  pathname = "/dashboard/equipo";
  render();
  effects.splice(0).forEach(effect => effect());
  await new Promise(setImmediate);
  assert.equal(contains(render(), "Escanear invitación"), true);
  premium = false;
  pathname = "/dashboard/usuarios";
  render();
  effects.splice(0).forEach(effect => effect());
  await new Promise(setImmediate);
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

test("El primer registro consume el QR actual incluso si quedan pases disponibles", async () => {
  const f = fixture();
  const route = loadSource("app/api/entradas/route.ts", f.mocks);
  const lookup = await route.GET(new Request("http://localhost/api/entradas?evento_id=event-a&codigo=monarque:entrada:code-a"));
  assert.equal((await lookup.json()).invitado.id, f.guest.id);
  const entry = await route.POST(request({ codigo: "monarque:entrada:code-a", cantidad: 1 }));
  assert.equal(entry.status, 200);
  assert.equal(f.logs[0].escaneado_por_id, "organizer");
  const second = await route.POST(request({ codigo: "code-a", cantidad: 1 }));
  assert.equal(second.status, 409);
  const duplicate = await second.json();
  assert.equal(duplicate.code, "ALREADY_SCANNED");
  assert.equal(duplicate.invitado.pases_ingresados, 1);
  assert.ok(duplicate.invitado.ultima_entrada_en);
  const table = await route.GET(new Request("http://localhost/api/entradas?evento_id=event-a&page=1"));
  const data = await table.json();
  assert.equal(data.asistentes.length, 1);
  assert.equal(data.asistentes[0].pases_ingresados, 1);
  assert.equal(data.pagination.total, 1);
  assert.equal((await route.POST(request({ codigo: "code-a", cantidad: 1 }))).status, 409);
  assert.equal(f.logs.length, 1);
});

test("Sin premium, otro organizador y una clienta no pueden usar el lector", async () => {
  const f = fixture();
  const route = loadSource("app/api/entradas/route.ts", f.mocks);
  f.organization.qr_checkin_habilitado = false;
  assert.equal((await route.POST(request({ codigo: "code-a", cantidad: 1 }))).status, 403);
  f.organization.qr_checkin_habilitado = true;
  f.setUser({ rol: "organizador", organizacion_id: "org-b", organizacion: f.organization });
  assert.equal((await route.POST(request({ codigo: "code-a", cantidad: 1 }))).status, 403);
  assert.equal((await route.GET(new Request("http://localhost/api/entradas?evento_id=event-a"))).status, 403);
  f.setUser({ rol: "clienta", organizacion_id: "org-a", organizacion: f.organization });
  assert.equal((await route.GET(new Request("http://localhost/api/entradas?evento_id=event-a&codigo=code-a"))).status, 403);
  assert.equal(f.logs.length, 0);
});

test("Un pase de otra fiesta se rechaza sin registrar asistencia", async () => {
  const f = fixture();
  const otherEvent = { ...f.event, id: "event-b", nombre: "Fiesta contraria" };
  f.prisma.evento.findFirst = async ({ where }) => where.id === "event-b" ? otherEvent : null;
  const route = loadSource("app/api/entradas/route.ts", f.mocks);
  const lookup = await route.GET(new Request("http://localhost/api/entradas?evento_id=event-b&codigo=code-a"));
  assert.equal(lookup.status, 409);
  assert.equal((await lookup.json()).code, "WRONG_EVENT");
  const entry = await route.POST(request({ evento_id: "event-b", codigo: "code-a", cantidad: 1 }));
  assert.equal(entry.status, 409);
  assert.equal((await entry.json()).code, "WRONG_EVENT");
  assert.equal(f.logs.length, 0);
  assert.equal(f.guest.pases_ingresados, 0);
});

test("El modo parcial permite reingresar el mismo QR hasta consumir sus pases", async () => {
  const f = fixture();
  f.event.modo_ingreso = "parcial";
  const route = loadSource("app/api/entradas/route.ts", f.mocks);
  assert.equal((await route.POST(request({ codigo: "code-a", cantidad: 1 }))).status, 200);
  assert.equal((await route.POST(request({ codigo: "code-a", cantidad: 1 }))).status, 200);
  const exhausted = await route.POST(request({ codigo: "code-a", cantidad: 1 }));
  assert.equal(exhausted.status, 409);
  assert.equal((await exhausted.json()).code, "ALREADY_SCANNED");
  assert.equal(f.logs.length, 2);
  assert.equal(f.guest.pases_ingresados, 2);
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

 test("Los QR usados anteriormente se rechazan por contador o marca del código actual", async () => {
  for (const marker of ["parcial", "completo", "escaneado"]) {
    const f = fixture();
    f.guest.pases_ingresados = marker === "completo" ? 2 : marker === "parcial" ? 1 : 0;
    f.guest.escaneado_en = marker === "escaneado" || marker === "parcial" ? new Date("2026-10-23T20:00:00Z") : null;
    const route = loadSource("app/api/entradas/route.ts", f.mocks);
    const lookup = await route.GET(new Request("http://localhost/api/entradas?evento_id=event-a&codigo=code-a"));
    assert.equal(lookup.status, 200);
    const response = await route.POST(request({ codigo: "code-a", cantidad: 1 }));
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, "ALREADY_SCANNED");
    assert.equal(f.logs.length, 0);
  }
});

 test("La consulta pública devuelve solo el estado del token y evita caché", async () => {
  const f = fixture();
  f.guest.evento.usuario.organizacion = f.organization;
  f.prisma.invitado.findUnique = async ({ where }) => where.token === "token-a" ? f.guest : null;
  const route = loadSource("app/api/invitacion/entrada/route.ts", { ...f.mocks, "@/lib/ratelimit": { checkRateLimit: () => true } });
  const read = token => route.GET(new Request("http://localhost/api/invitacion/entrada?token=" + token));
  let response = await read("token-a");
  assert.match(response.headers.get("Cache-Control"), /no-store/);
  assert.deepEqual(await response.json(), { escaneado: false, confirmado: true });
  f.guest.pases_ingresados = 1;
  f.guest.escaneado_en = new Date("2026-10-23T20:00:00Z");
  assert.deepEqual(await (await read("token-a")).json(), { escaneado: true, confirmado: true });
  assert.equal((await read("invalido")).status, 404);
  f.organization.qr_checkin_habilitado = false;
  assert.equal((await read("token-a")).status, 404);
 });

 test("El pase QR ya cargado no consulta al cambiar de pestaña o de aplicación", async () => {
  const states = [], effects = [], listeners = {};
  let cursor = 0, requests = 0;
  const doc = { visibilityState: "visible", addEventListener: (name, fn) => { listeners[name] = fn; }, removeEventListener: name => { delete listeners[name]; } };
  const component = loadSource("components/InvitationQrPass.tsx", {
    "next/image": "img",
    react: {
      useState: initial => { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = value; }]; },
      useEffect: fn => effects.push(fn),
    },
  }, {
    document: doc, AbortController,
    window: { addEventListener: (name, fn) => { listeners[name] = fn; }, removeEventListener: name => { delete listeners[name]; } },
    fetch: async () => { requests++; return Response.json({ escaneado: false, confirmado: true }); },
  }).default;
  component({ image: "data:image/png;base64,test", token: "token-a", guestName: "Prueba", passes: 2, confirmed: true });
  const cleanups = effects.splice(0).map(fn => fn());
  for (let index = 0; index < 5; index++) {
    doc.visibilityState = "hidden";
    listeners.visibilitychange?.();
    doc.visibilityState = "visible";
    listeners.visibilitychange?.();
    listeners.focus?.();
  }
  await new Promise(setImmediate);
  assert.equal(requests, 0);
  assert.equal(listeners.visibilitychange, undefined);
  assert.equal(listeners.focus, undefined);
  cleanups.forEach(fn => fn?.());
 });

 test("El escáner rechaza pendientes, vistos y confirmaciones sin pases sin registrar ingresos", async () => {
  for (const [estado, pases] of [["pendiente", null], ["visto", 2], ["confirmado", null], ["confirmado", 0]]) {
    const f = fixture(); f.guest.estado = estado; f.guest.pases_confirmados = pases;
    const route = loadSource("app/api/entradas/route.ts", f.mocks);
    const lookup = await route.GET(new Request("http://localhost/api/entradas?evento_id=event-a&codigo=code-a"));
    assert.equal(lookup.status, 409);
    assert.equal((await lookup.json()).code, "NOT_CONFIRMED");
    const response = await route.POST(request({ codigo: "code-a", cantidad: 1 }));
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, "NOT_CONFIRMED");
    assert.equal(f.logs.length, 0);
    assert.equal(f.guest.pases_ingresados, 0);
  }
 });

 test("El servidor entrega la imagen QR solo tras confirmar y nunca después de usarla", async () => {
  const f = fixture();
  f.guest.evento.usuario.organizacion = f.organization;
  f.prisma.invitado.findUnique = async ({ where }) => where.token === "token-a" ? f.guest : null;
  let generated = 0;
  const route = loadSource("app/api/invitacion/entrada/route.ts", { ...f.mocks,
    "@/lib/ratelimit": { checkRateLimit: () => true },
    qrcode: { toDataURL: async value => { generated++; assert.equal(value, "monarque:entrada:code-a"); return "data:image/png;base64,qr"; } },
  });
  const read = () => route.GET(new Request("http://localhost/api/invitacion/entrada?token=token-a&qr=1"));
  for (const estado of ["pendiente", "visto", "declinado"]) {
    f.guest.estado = estado;
    const data = await (await read()).json();
    assert.equal(data.confirmado, false);
    assert.equal(data.qrImage, undefined);
  }
  assert.equal(generated, 0);
  f.guest.estado = "confirmado";
  const active = await (await read()).json();
  assert.equal(active.confirmado, true);
  assert.equal(active.qrImage, "data:image/png;base64,qr");
  f.guest.pases_ingresados = 1;
  f.guest.escaneado_en = new Date("2026-10-23T20:00:00Z");
  assert.equal((await (await read()).json()).qrImage, undefined);
  assert.equal(generated, 1);
 });

 test("Un QR renovado registra únicamente los pases adicionales sin borrar ingresos previos", async () => {
  const f = fixture();
  f.guest.pases_confirmados = 5;
  f.guest.pases_ingresados = 2;
  f.guest.ultima_entrada_en = new Date("2026-10-23T20:00:00Z");
  f.guest.escaneado_en = null;
  f.guest.codigo_entrada = "code-renovado";
  const route = loadSource("app/api/entradas/route.ts", f.mocks);
  const response = await route.POST(request({ codigo: "code-renovado", cantidad: 3 }));
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.registro_adicional, true);
  assert.equal(data.invitado.pases_ingresados, 5);
  assert.match(data.message, /Pases adicionales registrados/);
  assert.equal(f.logs.length, 1);
  assert.equal(f.logs[0].cantidad, 3);
 });

 test("El pase pendiente no consulta ni muestra QR y lo carga al confirmar sin recargar", async () => {
  const states = [], effects = [], cleanups = [];
  let cursor = 0, requests = 0, confirmed = false;
  const component = loadSource("components/InvitationQrPass.tsx", {
    "next/image": "img",
    react: { useState: initial => { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = value; }]; }, useEffect: callback => effects.push(callback) },
  }, {
    AbortController, document: { visibilityState: "visible", addEventListener: () => {}, removeEventListener: () => {} },
    window: { addEventListener: () => {}, removeEventListener: () => {} },
    fetch: async url => { requests++; assert.match(url, /qr=1/); return Response.json({ confirmado: true, escaneado: false, qrImage: "data:image/png;base64,new" }); },
  }).default;
  const render = () => { cursor = 0; return component({ image: null, confirmed, token: "token-a", guestName: "Prueba", passes: 2 }); };
  const contains = (node, value) => node === value || (Array.isArray(node) ? node.some(child => contains(child, value)) : node && typeof node === "object" ? Object.values(node.props || {}).some(child => contains(child, value)) : false);
  const pending = render();
  assert.equal(contains(pending, "Confirma tu asistencia para obtener tu pase QR"), true);
  effects.splice(0).forEach(callback => cleanups.push(callback()));
  assert.equal(requests, 0);
  confirmed = true; render();
  effects.splice(0).forEach(callback => cleanups.push(callback()));
  await new Promise(setImmediate);
  assert.equal(requests, 1);
  assert.equal(contains(render(), "data:image/png;base64,new"), true);
  cleanups.forEach(callback => callback?.());
 });

 test("La acción directa de no asistir guarda cero pases y oculta el QR en ambas plantillas", async () => {
  for (const file of ["app/templates/WeddingPersonalized.tsx", "app/templates/WeddingOliveVintage.tsx"]) {
    const states = []; let cursor = 0, sent, calls = 0;
    const guest = { nombre: "Prueba", pases_asignados: 4, pases_confirmados: 3, ninos_confirmados: 1, estado: "confirmado", ultima_respuesta_en: null };
    const evento = { nombre: "Evento", anfitriones: "Ana y Luis", fecha_evento: "2027-01-01T18:00:00Z", fecha_limite_rsvp: "2026-12-31T23:00:00Z", lugar: "Salón", expirado: false };
    const component = loadSource(file, {
      react: { useState: initial => { const index = cursor++; if (!(index in states)) states[index] = index === 0 ? true : typeof initial === "function" ? initial() : initial; return [states[index], value => { states[index] = typeof value === "function" ? value(states[index]) : value; }]; }, useEffect: () => {} },
      "motion/react": { useReducedMotion: () => true, AnimatePresence: "div", motion: new Proxy({}, { get: (_object, key) => String(key) }) },
      "next/image": "img", "next/font/google": { Cormorant_Garamond: () => ({ variable: "font-a" }), Libre_Baskerville: () => ({ variable: "font-b" }) },
      "@/lib/rsvp-state": loadSource("lib/rsvp-state.ts", {}),
      "@/components/AsyncButton": "action-button", "@/components/InvitationQrPass": "qr-pass", "@/app/components/CountDown": "countdown",
      "@/lib/utils": { formatDateLongMx: () => "fecha", formatDateMx: () => "fecha" },
      "@/lib/event-theme": { genericInvitationTheme: { background: "white", surface: "white", primary: "green", secondary: "gold", accent: "gold", ink: "black", muted: "gray" } },
    }, { fetch: async (_url, options) => { calls++; sent = JSON.parse(options.body); return Response.json({ ok: true, mensaje: "Gracias por avisarnos", invitado: { ...guest, pases_confirmados: 0, ninos_confirmados: 0, estado: "declinado" } }); } }).default;
    const props = { data: { event: { name: "Ana & Luis", date: evento.fecha_evento, itinerary: [] }, media: { coverImage: "image.jpg", gallery: [] }, location: { event: "Ceremonia", reception: "Salón" } }, invitado: guest, evento, token: "token-a", qrEnabled: true, qrImage: "data:image/png;base64,test" };
    const render = extra => { cursor = 0; return component({ ...props, ...extra }); };
    const nodes = node => !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
    const before = nodes(render());
    assert.ok(before.some(node => node.type === "qr-pass"));
    const savedConfirmation = before.find(node => node.type === "action-button");
    assert.equal(savedConfirmation.props.disabled, true);
    await savedConfirmation.props.onClick();
    assert.equal(calls, 0);
    const decline = before.find(node => node.type === "action-button" && Array.isArray(node.props.children) && node.props.children.includes("No podré asistir"));
    assert.ok(decline, file);
    await decline.props.onClick();
    assert.deepEqual(sent, { token: "token-a", pases_confirmados: 0, ninos_confirmados: 0 });
    const after = nodes(render());
    assert.equal(after.some(node => node.type === "qr-pass"), false);
    assert.ok(states.some(value => value && value.estado === "declinado"));
    const savedDecline = after.find(node => node.type === "action-button");
    assert.equal(savedDecline.props.disabled, true);
    await savedDecline.props.onClick();
    assert.equal(calls, 1);
  }
 });

 test("Una respuesta solo se puede reenviar cuando cambian los pases, niños o decisión", () => {
  const { isRsvpUnchanged } = loadSource("lib/rsvp-state.ts", {});
  const confirmed = { estado: "confirmado", pases_confirmados: 3, ninos_confirmados: 1 };
  assert.equal(isRsvpUnchanged(confirmed, 3, 1), true);
  assert.equal(isRsvpUnchanged(confirmed, 2, 1), false);
  assert.equal(isRsvpUnchanged(confirmed, 3, 0), false);
  assert.equal(isRsvpUnchanged(confirmed, 0, 0), false);
  const declined = { estado: "declinado", pases_confirmados: 0, ninos_confirmados: 0 };
  assert.equal(isRsvpUnchanged(declined, 0, 0), true);
  assert.equal(isRsvpUnchanged(declined, 1, 0), false);
  assert.equal(isRsvpUnchanged({ estado: "pendiente", pases_confirmados: null }, 0, 0), false);
 });
