const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

test('Solo actualiza el aviso al recibir ATTENDANCE_LOCKED, sin consultas de fondo', () => {
  let state = null;
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('components/useInvitationAttendance.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { exports, require: name => {
    assert.equal(name, 'react');
    return { useState: () => [state, next => { state = next; }] };
  } });
  const first = exports.default('token');
  assert.equal(first.attendance, null);
  first.onRejected({ code: 'OTHER_ERROR' });
  assert.equal(state, null);
  const attendance = { pases_ingresados: 4, pases_confirmados: 8, confirmacion_bloqueada: true, escaneado: false };
  first.onRejected({ code: 'ATTENDANCE_LOCKED', attendance });
  assert.equal(exports.default('token').attendance.pases_ingresados, 4);
  assert.equal(exports.default('token').attendance.confirmacion_bloqueada, true);
  assert.equal(exports.default('another-token').attendance, null);
});

