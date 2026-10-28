const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const ts = require('typescript');

function fixture(role) {
  const event = { id: 'event', usuario_id: 'owner', fecha_evento: new Date('2099-02-01'), fecha_limite_rsvp: new Date('2099-01-01'), limite_pases: 200, estado: 'recepcion_abierta', usuario: {} };
  let writes = 0;
  const mocks = {
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '@/lib/auth': { getCurrentUser: async () => ({ id: 'owner', rol: role }) },
    '@/lib/prisma': { default: { evento: { findUnique: async () => event, update: async ({ data }) => { writes++; return { ...event, ...data }; } } } },
    '@/lib/pass-balance': { contractedPassLimit: () => 200 },
    '@/lib/names': { isValidName: () => true },
    '@/lib/utils': { isEventFinished: () => false, toDateInputValue: value => new Date(value).toISOString().slice(0, 10), toDateTimeInputValue: () => '' },
  };
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync('app/api/eventos/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(source, { exports, require: name => { if (!(name in mocks)) throw Error(name); return mocks[name]; }, Date, URL, console });
  return { save: data => exports.PUT(new Request('https://example.test/api/eventos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'event', ...data }) })), writes: () => writes };
}
test('Clienta y organizador no pueden cambiar publicación mediante la API', async () => {
  for (const role of ['clienta', 'organizador']) {
    const f = fixture(role);
    assert.equal((await f.save({ estado: 'cancelado' })).status, 403);
    assert.equal(f.writes(), 0);
  }
});
test('Admin puede elegir los tres estados y rechaza archivado', async () => {
  const f = fixture('admin');
  for (const estado of ['publicado', 'borrador', 'cancelado']) {
    const response = await f.save({ estado });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).evento.estado, estado);
  }
  assert.equal((await f.save({ estado: 'archivado' })).status, 400);
});
test('Guardar otros datos conserva la recepción abierta para cualquier rol', async () => {
  for (const role of ['admin', 'clienta']) {
    const response = await fixture(role).save({ texto_edad_nino: 'menores de 12 años' });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).evento.estado, 'recepcion_abierta');
  }
});
