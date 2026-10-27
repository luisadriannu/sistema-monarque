const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function harness(file) {
  const states = [], refs = [], effects = [], pushes = [];
  let stateIndex = 0, refIndex = 0, finish;
  const react = {
    useState: initial => {
      const index = stateIndex++;
      if (!(index in states)) states[index] = initial;
      return [states[index], value => { states[index] = value; }];
    },
    useRef: initial => {
      const index = refIndex++;
      return refs[index] ||= { current: initial };
    },
    useEffect: callback => effects.push(callback),
    useTransition: () => {
      const [pending, setPending] = react.useState(false);
      finish = () => setPending(false);
      return [pending, action => { setPending(true); action(); }];
    },
  };
  const mocks = { react, "next/link": "a", "next/navigation": { useRouter: () => ({ push: href => pushes.push(href) }) } };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => mocks[name] || require(name), console: { error: () => {} } });
  return {
    render: props => { stateIndex = 0; refIndex = 0; return exports.default(props); },
    effects: () => effects.splice(0).forEach(effect => effect()),
    finish: () => finish(), pushes,
  };
}

const event = (extras = {}) => ({ button: 0, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extras });

test("Guardar la fecha límite renueva la caché del resumen únicamente si el servidor confirma el cambio", async () => {
  for (const success of [true, false]) {
    const states = [], refs = [], effects = [];
    let stateIndex = 0, refIndex = 0, refreshes = 0, submitted;
    const stored = { id: "event", nombre: "Evento", fecha_evento: "2099-01-01T18:00:00Z", fecha_limite_rsvp: "2000-01-01T23:59:59-06:00", estado: "publicado", modo_ingreso: "parcial", recepcion_abre_en: null, recepcion_cierra_en: null };
    const react = {
      Suspense: "suspense",
      useState: initial => {
        const index = stateIndex++;
        if (!(index in states)) states[index] = initial;
        return [states[index], value => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
      },
      useRef: initial => { const index = refIndex++; return refs[index] ||= { current: initial }; },
      useEffect: callback => effects.push(callback),
    };
    const mocks = {
      react,
      "next/navigation": { useSearchParams: () => new URLSearchParams(), useRouter: () => ({ refresh: () => refreshes++ }) },
      "motion/react": { AnimatePresence: "div", motion: { div: "div" } },
      "@/components/AsyncButton": "button",
      "@/components/DashboardLoader": "div",
    };
    const globals = {
      window: { setInterval: () => 1, clearInterval: () => {}, addEventListener: () => {}, removeEventListener: () => {} },
      setTimeout: () => 1,
      fetch: async (_url, options) => {
        if (options?.method !== "PUT") return Response.json({ eventos: [stored], permisos: {} });
        submitted = JSON.parse(options.body);
        return success ? Response.json({ ok: true, evento: { ...stored, ...submitted } }) : Response.json({ error: "No se pudo guardar" }, { status: 500 });
      },
    };
    const load = file => {
      const exports = {};
      const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
        compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
      }).outputText;
      vm.runInNewContext(code, { exports, Date, console, ...globals,
        require: name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith("@/lib/") ? load(name.slice(2) + ".ts") : require(name),
      });
      return exports;
    };
    const Content = load("app/dashboard/configuracion/page.tsx").default().props.children.type;
    const render = () => { stateIndex = 0; refIndex = 0; return Content(); };
    const find = (node, predicate) => {
      if (!node) return null;
      if (Array.isArray(node)) return node.map(child => find(child, predicate)).find(Boolean);
      if (typeof node !== "object") return null;
      return predicate(node) ? node : find(node.props?.children, predicate);
    };
    render();
    effects.splice(0).forEach(callback => callback());
    await new Promise(setImmediate);
    const date = find(render(), node => node.type === "input" && node.props.type === "date");
    date.props.onChange({ target: { value: "2098-12-30" } });
    await find(render(), node => node.type === "form").props.onSubmit({ preventDefault() {} });
    assert.equal(submitted.fecha_limite_rsvp, "2098-12-31T05:59:59.999Z");
    assert.equal(refreshes, success ? 1 : 0);
    if (success) {
      assert.equal(states.some(value => value && typeof value === "object" && value.fecha_limite_rsvp === submitted.fecha_limite_rsvp), true);
    } else {
      assert.equal(states.includes("No se pudo guardar"), true);
    }
  }
});

function menuPosition() {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../lib/floating-menu.ts"), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(code, { exports });
  return exports.positionFloatingMenu;
}

test("El menú se coloca debajo sin exceder el borde derecho de la pantalla", () => {
  const position = menuPosition()({ top: 100, bottom: 130, right: 1010 }, 160, 1024, 768);
  assert.equal(position.top, 136);
  assert.ok(position.left + position.width <= 1016);
  assert.ok(position.left >= 8);
  assert.ok(position.maxHeight >= 160);
});

test("La última fila abre el menú hacia arriba cuando no cabe debajo", () => {
  const anchor = { top: 680, bottom: 710, right: 950 };
  const position = menuPosition()(anchor, 180, 1024, 768);
  assert.equal(position.top, 494);
  assert.ok(position.top + 180 < anchor.top);
});

test("En una pantalla estrecha el menú se limita al área visible", () => {
  const position = menuPosition()({ top: 20, bottom: 50, right: 35 }, 300, 180, 200);
  assert.equal(position.width, 164);
  assert.equal(position.left, 8);
  assert.ok(position.top >= 8);
  assert.ok(position.maxHeight > 0);
  assert.ok(position.top + position.maxHeight <= 192);
});

test("Una acción pendiente muestra loader y bloquea incluso clics anteriores al rerender", async () => {
  const h = harness("components/AsyncButton.tsx");
  let calls = 0, release;
  const props = { children: "Exportar", onClick: () => { calls++; return new Promise(resolve => { release = resolve; }); } };
  const button = h.render(props).props.children[0];
  const first = button.props.onClick(event());
  await button.props.onClick(event());
  const pending = h.render(props).props.children[0];
  assert.equal(calls, 1);
  assert.equal(pending.props.disabled, true);
  assert.equal(pending.props["aria-busy"], true);
  release(); await first;
  assert.equal(h.render(props).props.children[0].props.disabled, false);
});

test("Al fallar una petición se libera el botón y permite reintentar", async () => {
  const h = harness("components/AsyncButton.tsx");
  let calls = 0;
  const props = { children: "Guardar", onClick: async () => { calls++; throw new Error("Sin conexión"); } };
  await h.render(props).props.children[0].props.onClick(event());
  const result = h.render(props);
  assert.equal(result.props.children[0].props.disabled, false);
  assert.equal(result.props.children[1].props.role, "alert");
  await result.props.children[0].props.onClick(event());
  assert.equal(calls, 2);
});

test("Un submit conserva su comportamiento nativo y refleja la carga del formulario", () => {
  const h = harness("components/AsyncButton.tsx");
  const button = h.render({ type: "submit", loading: true, children: "Crear" }).props.children[0];
  assert.equal(button.props.type, "submit");
  assert.equal(button.props.disabled, true);
  assert.equal(button.props["aria-busy"], true);
});

test("Ver invitados navega una sola vez, indica carga y vuelve a habilitarse al terminar", () => {
  const h = harness("components/LoadingLink.tsx");
  const props = { href: "/dashboard/invitados?evento_id=prueba", children: "Ver invitados" };
  const link = h.render(props); h.effects();
  link.props.onClick(event()); link.props.onClick(event());
  assert.deepEqual(h.pushes, [props.href]);
  assert.equal(h.render(props).props["aria-busy"], true);
  h.finish(); const finished = h.render(props); h.effects();
  assert.equal(finished.props["aria-busy"], false);
  finished.props.onClick(event());
  assert.equal(h.pushes.length, 2);
});

test("Los enlaces conservan abrir en otra pestaña y los clics con Ctrl", () => {
  const h = harness("components/LoadingLink.tsx");
  const props = { href: "/dashboard/invitados", children: "Ver invitados" };
  const ctrl = event({ ctrlKey: true });
  h.render(props).props.onClick(ctrl);
  const newTab = event();
  h.render({ ...props, target: "_blank" }).props.onClick(newTab);
  assert.equal(ctrl.defaultPrevented, false);
  assert.equal(newTab.defaultPrevented, false);
  assert.equal(h.pushes.length, 0);
});
