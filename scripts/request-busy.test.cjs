const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const ts = require('typescript');
function load() {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync('lib/request-busy.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(source, { exports, URL, Request });
  return exports;
}
test('Bloquea escrituras locales, pero no lecturas, heartbeat ni dominios externos', () => {
  const { blocksDashboard } = load();
  const origin = 'https://monarque.test';
  assert.equal(blocksDashboard('/api/usuarios/1', { method: 'DELETE' }, origin), true);
  assert.equal(blocksDashboard(new Request(origin + '/api/invitados', { method: 'POST' }), undefined, origin), true);
  assert.equal(blocksDashboard('/api/auth/me', undefined, origin), false);
  assert.equal(blocksDashboard('/api/auth/activity', { method: 'POST' }, origin), false);
  assert.equal(blocksDashboard('https://external.test/api/test', { method: 'POST' }, origin), false);
});
test('Espera el cuerpo completo y conserva el bloqueo mientras haya otra operación pendiente', async () => {
  const { trackBusyRequests } = load();
  const counts = [], resolvers = [];
  const fetcher = trackBusyRequests(() => new Promise(resolve => resolvers.push(resolve)), 'https://monarque.test', n => counts.push(n));
  const first = fetcher('/api/invitados/1', { method: 'DELETE' });
  const second = fetcher('/api/invitados/2', { method: 'DELETE' });
  assert.deepEqual(counts, [1, 2]);
  let finish;
  const stream = new ReadableStream({ start(controller) { finish = () => { controller.enqueue(new TextEncoder().encode('{"ok":true}')); controller.close(); }; } });
  resolvers[0](new Response(stream, { headers: { 'Content-Type': 'application/json' } }));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(counts.at(-1), 2);
  finish();
  const response = await first;
  assert.equal((await response.json()).ok, true);
  assert.equal(counts.at(-1), 1);
  resolvers[1](Response.json({ error: 'failed' }, { status: 500 }));
  await second;
  assert.equal(counts.at(-1), 0);
});
test('Libera el bloqueo ante un fallo de red', async () => {
  const { trackBusyRequests } = load();
  const counts = [];
  const fetcher = trackBusyRequests(async () => { throw Error('network'); }, 'https://monarque.test', n => counts.push(n));
  await assert.rejects(fetcher('/api/usuarios/1', { method: 'DELETE' }), /network/);
  assert.deepEqual(counts, [1, 0]);
});
