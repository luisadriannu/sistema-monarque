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
