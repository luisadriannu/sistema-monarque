const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

test('Header y menú lateral cambian el tema al primer clic y mantienen sus etiquetas sincronizadas', () => {
  let dark = false, current, index;
  const observers = new Set(), storage = new Map();
  const root = { classList: { contains: () => dark, add: () => { dark = true; }, remove: () => { dark = false; } } };
  const react = {
    useState: initial => { const instance = current, slot = index++; if (!(slot in instance.states)) instance.states[slot] = initial; return [instance.states[slot], value => { instance.states[slot] = value; }]; },
    useEffect: effect => { if (!current.mounted) current.effects.push(effect); },
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('components/ThemeToggle.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, document: { documentElement: root }, localStorage: { setItem: (key, value) => storage.set(key, value) }, MutationObserver: class {
    constructor(callback) { this.callback = callback; }
    observe() { observers.add(this.callback); }
    disconnect() { observers.delete(this.callback); }
  }, require: name => name === 'react' ? react : name === 'lucide-react' ? { Sun: 'sun', Moon: 'moon' } : require(name) });
  const instance = compact => ({ compact, states: [], effects: [], cleanups: [], mounted: false });
  const header = instance(true), menu = instance(false);
  const render = item => { current = item; index = 0; return exports.default({ compact: item.compact }); };
  for (const item of [header, menu]) { render(item); item.cleanups = item.effects.map(effect => effect()); item.mounted = true; }
  const flush = () => observers.forEach(callback => callback());
  render(header).props.onClick();
  flush();
  assert.equal(dark, true);
  assert.equal(render(menu).props['aria-label'], 'Cambiar a modo claro');
  render(menu).props.onClick();
  flush();
  assert.equal(dark, false);
  assert.equal(storage.get('monarque_theme'), 'light');
  assert.equal(render(header).props['aria-label'], 'Cambiar a modo oscuro');
  // Incluso un callback anterior al último render usa el tema real del documento.
  const staleClick = render(menu).props.onClick;
  render(header).props.onClick();
  staleClick();
  flush();
  assert.equal(dark, false);
  for (const item of [header, menu]) item.cleanups.forEach(cleanup => cleanup());
  assert.equal(observers.size, 0);
});
