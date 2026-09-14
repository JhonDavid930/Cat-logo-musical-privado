import { spawn } from "node:child_process";
import { randomBytes, scryptSync } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
const password = randomBytes(24).toString("hex"),
  salt = randomBytes(16).toString("hex");
const dataDirectory = await mkdtemp(join(tmpdir(), "da-auth-test-"));
const origin = "https://catalog.test";
const server = spawn(process.execPath, [".next/standalone/server.js"], {
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: "3001",
    HOSTNAME: "127.0.0.1",
    CATALOG_DATA_DIR: dataDirectory,
    CATALOG_STORAGE: "sqlite",
    CATALOG_APP_URL: origin,
    CATALOG_PASSWORD_HASH:
      salt + ":" + scryptSync(password, salt, 64).toString("hex"),
    CATALOG_SESSION_SECRET: randomBytes(48).toString("hex"),
  },
  stdio: "ignore",
});
const base = "http://127.0.0.1:3001";
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch(base + "/api/health")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.ok(ready, "El servidor de prueba debe arrancar.");
  assert.equal((await fetch(base + "/api/catalog")).status, 401);
  const denied = await fetch(base + "/api/auth", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ password: "incorrecta" }),
  });
  assert.equal(denied.status, 401);
  const login = await fetch(base + "/api/auth", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
  assert.equal(login.status, 200);
  const header = login.headers.get("set-cookie");
  assert.ok(header.includes("HttpOnly"));
  assert.ok(header.includes("Secure"));
  assert.ok(header.includes("SameSite=strict"));
  const cookie = header.split(";")[0];
  assert.equal(
    (await fetch(base + "/api/catalog", { headers: { cookie } })).status,
    200,
  );
  assert.equal(
    (
      await fetch(base + "/api/catalog", {
        headers: { cookie: cookie + "tampered" },
      })
    ).status,
    401,
  );
  const page = await (await fetch(base)).text();
  assert.ok(page.includes("Contraseña"));
  assert.ok(!page.includes("BILINGUE"));
  process.stdout.write(
    "Producción: acceso anónimo rechazado; login y cookie segura correctos; sesión manipulada rechazada; catálogo real no utilizado.\n",
  );
} finally {
  server.kill();
}
