const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function fixture(changes = {}) {
  const guest = { estado: 'confirmado', pases_confirmados: 8, pases_ingresados: 4, escaneado_en: new Date(), codigo_entrada: 'secret-entry-code', evento: { estado: 'recepcion_abierta', modo_ingreso: 'parcial', usuario: { organizacion_id: 'monarque-clientes-directos', lector_qr_habilitado: true, organizacion: { qr_checkin_habilitado: true, estado_servicio: 'activo', servicio_vence_en: null } } }, ...changes };
  let generated = 0;
  const mocks = {
    'next/server': { NextResponse: class extends Response {} },
    '@/lib/prisma': { default: { invitado: { findUnique: async () => guest } } },
    '@/lib/ratelimit': { checkRateLimit: () => true },
    '@/lib/organization-access': { isOrganizationServiceActive: () => true },
    '@/lib/qr-access': { hasClientQr: user => user.lector_qr_habilitado },
    qrcode: { default: { toBuffer: async value => { assert.equal(value, 'monarque:entrada:secret-entry-code'); generated++; return Buffer.from([137, 80, 78, 71]); } } },
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('app/api/invitacion/entrada/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { exports, require: name => mocks[name], Uint8Array, URL, console });
  return { guest, download: () => exports.GET(new Request('https://example.test/api/invitacion/entrada?token=token&download=1')), generated: () => generated };
}
test('Entrega PNG descargable con saldo parcial e impide almacenamiento en caché', async () => {
  const f = fixture();
  const response = await f.download();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/png');
  assert.match(response.headers.get('content-disposition'), /attachment/);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal(f.generated(), 1);
});
test('No permite descargar antes de confirmar, después de agotar pases o sin QR contratado', async () => {
  for (const changes of [{ estado: 'pendiente', pases_confirmados: null }, { estado: 'declinado', pases_confirmados: 0 }, { pases_ingresados: 8 }]) {
    const f = fixture(changes);
    assert.equal((await f.download()).status, 409);
    assert.equal(f.generated(), 0);
  }
  const disabled = fixture();
  disabled.guest.evento.usuario.lector_qr_habilitado = false;
  assert.equal((await disabled.download()).status, 404);
  assert.equal(disabled.generated(), 0);
});
test('Una sola llegada no permite descargar de nuevo un QR utilizado', async () => {
  const f = fixture();
  f.guest.evento.modo_ingreso = 'unico';
  assert.equal((await f.download()).status, 409);
  assert.equal(f.generated(), 0);
});
