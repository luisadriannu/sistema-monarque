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
    "@/components/LoadingLink": "a",
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

test("El primer registro consume el QR incluso si quedan pases disponibles", async () => {
  const f = fixture();
  const route = loadSource("app/api/entradas/route.ts", f.mocks);
  const lookup = await route.GET(new Request("http://localhost/api/entradas?codigo=monarque:entrada:code-a"));
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
  const table = await route.GET(new Request("http://localhost/api/entradas?page=1"));
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

 test("Los QR usados anteriormente se rechazan por contador o fecha de ingreso", async () => {
  for (const marker of ["parcial", "completo", "fecha"]) {
    const f = fixture();
    f.guest.pases_ingresados = marker === "completo" ? 2 : marker === "parcial" ? 1 : 0;
    f.guest.ultima_entrada_en = marker === "fecha" ? new Date("2026-10-23T20:00:00Z") : null;
    const route = loadSource("app/api/entradas/route.ts", f.mocks);
    const lookup = await route.GET(new Request("http://localhost/api/entradas?codigo=code-a"));
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
  assert.deepEqual(await (await read("token-a")).json(), { escaneado: true, confirmado: true });
  assert.equal((await read("invalido")).status, 404);
  f.organization.qr_checkin_habilitado = false;
  assert.equal((await read("token-a")).status, 404);
 });

 test("El pase consulta cada 60 segundos, pausa oculto y oculta el QR al detectar ingreso", async () => {
  const states = [], effects = [], cleanups = [], listeners = {};
  let cursor = 0, interval, requests = 0, scanned = false, timerCleared = false;
  const doc = { visibilityState: "visible", addEventListener: (name, fn) => { listeners[name] = fn; }, removeEventListener: name => { delete listeners[name]; } };
  const component = loadSource("components/InvitationQrPass.tsx", {
    "next/image": "img",
    react: {
      useState: initial => { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = value; }]; },
      useEffect: fn => effects.push(fn),
    },
  }, {
    document: doc, AbortController,
    window: { setInterval: (fn, ms) => { assert.equal(ms, 60000); interval = fn; return 1; }, clearInterval: () => { timerCleared = true; } },
    fetch: async () => { requests++; return Response.json({ escaneado: scanned, confirmado: true }); },
  }).default;
  const render = () => { cursor = 0; return component({ image: "data:image/png;base64,test", token: "token-a", guestName: "Prueba", passes: 2, confirmed: true }); };
  const contains = (node, value) => node === value || (Array.isArray(node) ? node.some(child => contains(child, value)) : node && typeof node === "object" ? Object.values(node.props || {}).some(child => contains(child, value)) : false);
  assert.equal(contains(render(), "data:image/png;base64,test"), true);
  effects.splice(0).forEach(fn => cleanups.push(fn()));
  await new Promise(setImmediate);
  assert.equal(requests, 1);
  doc.visibilityState = "hidden";
  await interval();
  assert.equal(requests, 1);
  doc.visibilityState = "visible";
  listeners.visibilitychange();
  await new Promise(setImmediate);
  assert.equal(requests, 2);
  scanned = true;
  await interval();
  assert.equal(contains(render(), "data:image/png;base64,test"), false);
  assert.equal(contains(render(), "Tu entrada ya fue escaneada"), true);
  cleanups.forEach(fn => fn?.());
  effects.splice(0).forEach(fn => fn());
  assert.equal(timerCleared, true);
  assert.equal(listeners.visibilitychange, undefined);
 });

 test("El escáner rechaza pendientes, vistos y confirmaciones sin pases sin registrar ingresos", async () => {
  for (const [estado, pases] of [["pendiente", null], ["visto", 2], ["confirmado", null], ["confirmado", 0]]) {
    const f = fixture(); f.guest.estado = estado; f.guest.pases_confirmados = pases;
    const route = loadSource("app/api/entradas/route.ts", f.mocks);
    const lookup = await route.GET(new Request("http://localhost/api/entradas?codigo=code-a"));
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
  assert.equal((await (await read()).json()).qrImage, undefined);
  assert.equal(generated, 1);
 });

 test("El pase pendiente no consulta ni muestra QR y lo carga al confirmar sin recargar", async () => {
  const states = [], effects = [], cleanups = [];
  let cursor = 0, requests = 0, confirmed = false;
  const component = loadSource("components/InvitationQrPass.tsx", {
    "next/image": "img",
    react: { useState: initial => { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = value; }]; }, useEffect: callback => effects.push(callback) },
  }, {
    AbortController, document: { visibilityState: "visible", addEventListener: () => {}, removeEventListener: () => {} },
    window: { setInterval: () => 1, clearInterval: () => {} },
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
