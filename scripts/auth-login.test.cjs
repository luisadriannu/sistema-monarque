const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const bcrypt = require("bcryptjs");

function loginHandler(databaseUrl) {
  const user = { id: "user-a", nombre: "Prueba", email: "prueba@example.com", rol: "organizador", passwordHash: bcrypt.hashSync("clave-prueba", 4) };
  const calls = { queries: 0, cookies: 0 };
  const mocks = {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "bcryptjs": bcrypt,
    "@/lib/prisma": { usuario: { findUnique: async ({ where }) => { calls.queries++; return where.email === user.email ? user : null; } } },
    "@/lib/auth": { createSessionToken: async () => "session-token", setSessionCookie: async () => { calls.cookies++; } },
  };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../app/api/auth/login/route.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports, require: name => mocks[name],
    process: { env: { DATABASE_URL: databaseUrl } },
    console: { error: () => {} },
  });
  return { post: exports.POST, calls };
}

function request(body) {
  return new Request("http://localhost/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

test("Sin DATABASE_URL responde con diagnóstico y no intenta consultar Prisma", async () => {
  for (const value of [undefined, "", "   "]) {
    const handler = loginHandler(value);
    const response = await handler.post(request({ email: "prueba@example.com", password: "clave-prueba" }));
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /DATABASE_URL/);
    assert.equal(handler.calls.queries, 0);
    assert.equal(handler.calls.cookies, 0);
  }
});

test("Una solicitud inválida responde 400 antes de acceder a la base de datos", async () => {
  const handler = loginHandler("postgresql://test");
  for (const body of [null, {}, { email: 123, password: "test" }, { email: "   ", password: "test" }, { email: "prueba@example.com", password: {} }]) {
    assert.equal((await handler.post(request(body))).status, 400);
  }
  const malformed = new Request("http://localhost/api/auth/login", { method: "POST", body: "{" });
  assert.equal((await handler.post(malformed)).status, 400);
  assert.equal(handler.calls.queries, 0);
});

test("Login normaliza el correo, verifica la contraseña y establece la sesión", async () => {
  const handler = loginHandler("postgresql://test");
  const response = await handler.post(request({ email: "  PRUEBA@EXAMPLE.COM  ", password: "clave-prueba" }));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.user.rol, "organizador");
  assert.equal(data.user.passwordHash, undefined);
  assert.equal(handler.calls.cookies, 1);
});

test("Credenciales incorrectas devuelven 401 sin establecer sesión", async () => {
  const handler = loginHandler("postgresql://test");
  for (const email of ["prueba@example.com", "otro@example.com"]) {
    assert.equal((await handler.post(request({ email, password: "incorrecta" }))).status, 401);
  }
  assert.equal(handler.calls.cookies, 0);
});
