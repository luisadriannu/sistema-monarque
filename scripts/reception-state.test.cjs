const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

test('Cerrar y reabrir el escáner no modifica la publicación ni las fechas programadas', async () => {
  const event = { id: 'event', estado: 'publicado', recepcion_estado: 'abierta', recepcion_abre_en: null, recepcion_cierra_en: null, usuario: {} };
  const changes = [];
  const mocks = {
    'next/server': { NextResponse: { json: (data, init) => Response.json(data, init) } },
    '@/lib/auth': { getCurrentUser: async () => ({ id: 'admin', rol: 'admin' }) },
    '@/lib/management-access': { canManageAccounts: () => true, accountScope: () => ({}) },
    '@/lib/qr-access': { hasClientQr: () => true },
    '@/lib/organization-access': {},
    '@/lib/prisma': { default: { evento: { findFirst: async () => event, update: async ({ data }) => { changes.push(data); Object.assign(event, data); return event; } } } },
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('app/api/eventos/[id]/recepcion/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { exports, require: name => mocks[name], Date });
  for (const action of ['cerrar', 'abrir']) {
    const response = await exports.PATCH(new Request('https://example.test', { method: 'PATCH', body: JSON.stringify({ action }) }), { params: Promise.resolve({ id: 'event' }) });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).evento.estado, 'publicado');
  }
  assert.equal(changes[0].recepcion_estado, 'cerrada');
  assert.equal(changes[0].estado, undefined);
  assert.equal(changes[0].recepcion_cierra_en, undefined);
  assert.equal(event.recepcion_estado, 'abierta');
});
