const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');

function fixture(entered, racing = false) {
  const guest = { id: 'guest', token: 'token', nombre: 'Familia', pases_asignados: 15, pases_confirmados: 12, ninos_confirmados: 0, pases_ingresados: entered, ultima_entrada_en: entered ? new Date() : null, escaneado_en: entered ? new Date() : null, estado: 'confirmado', evento: { usuario_id: 'owner', usuario: { organizacion_id: 'org' }, estado: 'recepcion_abierta', fecha_limite_rsvp: new Date('2099-01-01'), fecha_evento: new Date('2099-01-02') } };
  let writes = 0;
  const prisma = { invitado: {
    findUnique: async () => guest,
    updateMany: async ({ where }) => {
      assert.equal(where.pases_ingresados, 0);
      assert.equal(where.ultima_entrada_en, null);
      assert.equal(where.escaneado_en, null);
      if (racing || entered) return { count: 0 };
      writes++; return { count: 1 };
    },
  } };
  const mocks = {
    'next/server': { NextResponse: { json: (data, init) => Response.json(data, init) } },
    '@/lib/prisma': { default: prisma },
    '@/lib/auth': { getCurrentUser: async () => ({ id: 'admin', rol: 'admin' }) },
    '@/lib/ratelimit': { checkRateLimit: () => true },
    '@/lib/utils': { isEventFinished: () => false },
    '@/lib/tokens': { generateInvitationToken: () => 'new-token' },
  };
  function load(file) {
    const exports = {};
    const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    vm.runInNewContext(source, { exports, require: name => mocks[name] || (name.startsWith('@/') ? load(name.slice(2) + '.ts') : require(name)), Response, Date, console, URL });
    return exports;
  }
  const request = body => new Request('http://localhost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { load, request, writes: () => writes };
}

for (const entered of [6, 12]) {
  test(`Con ${entered} ingresos bloquea confirmar, declinar, cambiar pases y regenerar incluso como admin`, async () => {
    const f = fixture(entered);
    const rsvp = f.load('app/api/rsvp/route.ts');
    for (const passes of [0, 12, 15]) assert.equal((await rsvp.POST(f.request({ token: 'token', pases_confirmados: passes }))).status, 409);
    const edit = f.load('app/api/invitados/[id]/route.ts');
    for (const body of [{ pases_asignados: 20 }, { pases_asignados: 10 }, { action: 'regenerar_link' }]) {
      assert.equal((await edit.PUT(f.request(body), { params: Promise.resolve({ id: 'guest' }) })).status, 409);
    }
    assert.equal(f.writes(), 0);
  });
}
test('Antes del ingreso permite confirmar, cambiar pases y regenerar', async () => {
  const f = fixture(0);
  assert.equal((await f.load('app/api/rsvp/route.ts').POST(f.request({ token: 'token', pases_confirmados: 15 }))).status, 200);
  const edit = f.load('app/api/invitados/[id]/route.ts');
  for (const body of [{ pases_asignados: 20 }, { action: 'regenerar_link' }]) assert.equal((await edit.PUT(f.request(body), { params: Promise.resolve({ id: 'guest' }) })).status, 200);
  assert.equal(f.writes(), 3);
});
test('Si el primer escaneo se adelanta al guardado rechaza la modificación', async () => {
  const f = fixture(0, true);
  assert.equal((await f.load('app/api/rsvp/route.ts').POST(f.request({ token: 'token', pases_confirmados: 15 }))).status, 409);
  const edit = f.load('app/api/invitados/[id]/route.ts');
  for (const body of [{ pases_asignados: 20 }, { action: 'regenerar_link' }]) assert.equal((await edit.PUT(f.request(body), { params: Promise.resolve({ id: 'guest' }) })).status, 409);
  assert.equal(f.writes(), 0);
});

test('El saldo conserva reservas hasta el ingreso y recupera sobrantes sin borrar el original', () => {
  const f = fixture(0);
  const { committedPasses, recoveredPasses, releasablePasses } = f.load('lib/pass-balance.ts');
  const guest = { estado: 'confirmado', pases_asignados: 10, pases_confirmados: 8, pases_ingresados: 0 };
  assert.equal(committedPasses(guest), 10);
  assert.equal(recoveredPasses(guest), 0);
  guest.pases_ingresados = 4;
  assert.equal(committedPasses(guest), 8);
  assert.equal(recoveredPasses(guest), 2);
  guest.pases_ingresados = 8;
  assert.equal(recoveredPasses(guest), 2);
  assert.equal(guest.pases_asignados, 10);
  const declined = { estado: 'declinado', pases_asignados: 5, pases_confirmados: 0, pases_ingresados: 0 };
  assert.equal(committedPasses(declined), 5);
  assert.equal(releasablePasses(declined), 5);
  declined.pases_liberados = true;
  assert.equal(committedPasses(declined), 0);
  assert.equal(recoveredPasses(declined), 5);
  assert.equal(releasablePasses(declined), 0);
});

test('La liberación manual solo acepta declinados sin ingresos y es condicional', async () => {
  const f = fixture(0);
  // The real conditional update includes estado and noAttendance: competing
  // confirmations or a second release cannot satisfy the same predicate.
  const edit = f.load('app/api/invitados/[id]/route.ts');
  assert.equal((await edit.PUT(f.request({ action: 'liberar_pases' }), { params: Promise.resolve({ id: 'guest' }) })).status, 200);
  const raced = fixture(0, true);
  assert.equal((await raced.load('app/api/invitados/[id]/route.ts').PUT(raced.request({ action: 'liberar_pases' }), { params: Promise.resolve({ id: 'guest' }) })).status, 409);
});
