const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { createRequire } = require("node:module");

// Ejecuta la política real de la versión instalada de Next con nuestra
// configuración; no hace peticiones ni conecta a la base de datos.
function cachePolicy(staleTimes) {
  const file = require.resolve("next/dist/client/components/router-reducer/prefetch-cache-utils");
  const exports = {};
  const localRequire = createRequire(file);
  vm.runInNewContext(fs.readFileSync(file, "utf8"), {
    exports, require: name => {
      // La prueba solo expira entradas; las funciones de red de Next no se usan.
      if (name === "./fetch-server-response" || name === "./reducers/prefetch-reducer") return {};
      return localRequire(name);
    }, URL, Date, console,
    process: { env: {
      NODE_ENV: "production",
      __NEXT_CLIENT_ROUTER_DYNAMIC_STALETIME: String(staleTimes.dynamic),
      __NEXT_CLIENT_ROUTER_STATIC_STALETIME: String(staleTimes.static),
    } },
  }, { filename: file });
  return exports;
}

test("El resumen previamente visitado o precargado expira antes de la siguiente navegación", async () => {
  const { default: config } = await import("../next.config.mjs");
  assert.equal(require("next/dist/server/config-schema").configSchema.safeParse(config).success, true);
  const now = Date.now();
  const entries = () => new Map([
    ["/dashboard", { kind: "full", prefetchTime: now - 1000, lastUsedTime: now - 500 }],
    ["/dashboard/invitados", { kind: "auto", prefetchTime: now - 1000, lastUsedTime: null }],
    ["/dashboard/configuracion", { kind: "temporary", prefetchTime: now - 1000, lastUsedTime: now - 500 }],
  ]);
  const oldCache = entries();
  cachePolicy({ dynamic: 0, static: 300 }).prunePrefetchCache(oldCache);
  assert.equal(oldCache.has("/dashboard"), true, "La política anterior podía conservar el resumen anterior");
  const currentCache = entries();
  cachePolicy(config.experimental.staleTimes).prunePrefetchCache(currentCache);
  assert.equal(currentCache.size, 0, "La siguiente navegación debe consultar de nuevo al servidor");
});
