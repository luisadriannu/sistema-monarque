const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const ts = require('typescript');
const { webcrypto } = require('node:crypto');

test('Caduca tras 60 minutos; la renovación debe estar firmada y pertenecer a la misma sesión', async () => {
  const jose = await import('jose');
  let now = Date.now();
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('lib/session-idle.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { exports, require: name => { assert.equal(name, 'jose'); return jose; }, TextEncoder, Uint8Array, crypto: webcrypto, Date: { now: () => now }, process: { env: { JWT_SECRET: 'test-secret-for-session-idle-123456', SESSION_IDLE_TIMEOUT_MINUTES: '60' } } });
  const session = await new jose.SignJWT({ userId: 'a' }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('7d').sign(exports.sessionKey());
  const other = await new jose.SignJWT({ userId: 'b' }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('7d').sign(exports.sessionKey());
  const activity = await exports.createActivityToken(session);
  assert.equal(await exports.validIdleSession(session, activity, now + 3599999), true);
  assert.equal(await exports.validIdleSession(session, activity, now + 3600000), false);
  assert.equal(await exports.validIdleSession(other, activity, now), false);
  assert.equal(await exports.validIdleSession(session, 'forged', now), false);
  assert.equal(await exports.validIdleSession(session, undefined, now), false);
  now += 1800000;
  const renewed = await exports.createActivityToken(session);
  assert.equal(await exports.validIdleSession(session, renewed, now + 3599999), true);
  const expired = await new jose.SignJWT({ userId: 'a' }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime(1).sign(exports.sessionKey());
  assert.equal(await exports.validIdleSession(expired, await exports.createActivityToken(expired), now), false);
});
