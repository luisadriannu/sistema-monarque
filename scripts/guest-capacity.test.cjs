const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');

function fixture(capacity = 60, limit = 200, fail = false) {
  const event = { id: 'event', usuario_id: 'owner', capacidad_total: capacity, limite_pases: limit, usuario: { organizacion_id: 'monarque-clientes-directos', organizacion: null } };
  const guests = [{ estado: 'pendiente', pases_asignados: 60, pases_confirmados: null, pases_ingresados: 0 }];
  let creates = 0, updates = 0;
  const tx = { evento: { findUniqueOrThrow: async () => event, update: async ({ data }) => { updates++; event.capacidad_total = data.capacidad_total; } }, invitado: { findMany: async () => guests, create: async ({ data }) => { if (fail) throw Error('simulated failure'); creates++; return data; } } };
  const prisma = { evento: { findUnique: async () => event }, $transaction: async (fn, options) => { assert.equal(options.isolationLevel, 'Serializable'); return fn(tx); } };
  const mocks = {
    'next/server': { NextResponse: { json: (data, options) => Response.json(data, options) } },
    '@/lib/prisma': { default: prisma },
    '@/lib/auth': { getCurrentUser: async () => ({ id: 'owner', rol: 'clienta' }) },
    '@/lib/utils': { isEventFinished: () => false },
    '@/lib/tokens': { generateInvitationToken: () => 'token' },
    '@/lib/names': { isValidName: value => Boolean(value), NAME_ERROR: 'name invalid' },
  };
  function load(file) {
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    vm.runInNewContext(code, { exports, require: name => mocks[name] || (name.startsWith('@/') ? load(name.slice(2) + '.ts') : name.startsWith('./') ? load(path.join(path.dirname(file), name + '.ts')) : require(name)), console: { error() {} }, Response, URL });
    return exports;
  }
  return { event, counts: () => ({ creates, updates }), save: async (extra = {}) => load('app/api/invitados/route.ts').POST(new Request('http://localhost/api/invitados', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ evento_id: 'event', nombre: 'Familia', pases_asignados: 10, ...extra }) })) };
}
test('Crear y aumentar de 60 a 70 ocurre en una transacción', async () => {
  const f = fixture(); const response = await f.save();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).capacidad_total, 70);
  assert.equal(f.event.capacidad_total, 70);
  assert.equal(f.counts().creates, 1);
});
test('Respeta contratación, capacidad opcional y rollback ante fallo de creación', async () => {
  const limited = fixture(60, 65);
  assert.equal((await limited.save()).status, 403);
  assert.deepEqual(limited.counts(), { creates: 0, updates: 0 });
  const optional = fixture(null);
  assert.equal((await optional.save()).status, 200);
  assert.equal(optional.event.capacidad_total, null);
  const failed = fixture(60, 200, true);
  assert.equal((await failed.save()).status, 500);
  assert.equal(failed.counts().updates, 0);
});
test('Importar también amplía al total comprometido', async () => {
  const f = fixture();
  const response = await f.save({ bulk: true, invitados: [{ nombre: 'Ana', pases: 4 }, { nombre: 'Luis', pases: 6 }] });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.importados, 2);
  assert.equal(data.capacidad_total, 70);
});
