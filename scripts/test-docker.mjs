import { spawn } from "node:child_process";
import { randomBytes, randomUUID, scryptSync, createHash } from "node:crypto";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

// Todo recurso pertenece a un proyecto nuevo; nunca usa secretos ni datos reales.
const root = process.cwd();
const directory = await mkdtemp(path.join(tmpdir(), "catalog-docker-check-"));
const project = `catalog-check-${randomBytes(5).toString("hex")}`;
const origin = "https://catalog.test";
const password = randomBytes(24).toString("hex");
const salt = randomBytes(16).toString("hex");
const image = "catalog-control-validation:local";
const secretNames = [
  "db_admin_password",
  "db_app_password",
  "catalog_password_hash",
  "session_secret",
];
for (const name of secretNames) {
  const value =
    name === "catalog_password_hash"
      ? `${salt}:${scryptSync(password, salt, 64).toString("hex")}`
      : randomBytes(48).toString("hex");
  await writeFile(path.join(directory, name), value, {
    flag: "wx",
    mode: 0o600,
  });
}
const override = path.join(directory, "test.yaml");
await writeFile(
  override,
  `services:
  app:
    image: ${image}
    restart: "no"
    ports: !override ["127.0.0.1::3000"]
    environment:
      CATALOG_APP_URL: ${origin}
  db:
    restart: "no"
secrets:
${secretNames.map((name) => `  ${name}:\n    file: ${JSON.stringify(path.join(directory, name))}`).join("\n")}
`,
);
const args = [
  "compose",
  "-p",
  project,
  "--project-directory",
  root,
  "-f",
  path.join(root, "compose.yaml"),
  "-f",
  override,
];
const report = { project, directory, checks: [], success: false };
const check = (name) => {
  report.checks.push(name);
  console.log(`OK: ${name}`);
};
function command(extra, { input, stream = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", extra, {
      cwd: root,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let output = "",
      errors = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
      if (stream) process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      errors += chunk;
      if (stream) process.stderr.write(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve(output.trim())
        : reject(
            new Error(
              `Docker ${extra[0]} fallo (${code}): ${errors.slice(-4000)}`,
            ),
          ),
    );
    child.stdin.end(input);
  });
}
const compose = (extra, options) => command([...args, ...extra], options);
const sql = (text, database = "catalog") =>
  compose(
    [
      "exec",
      "-T",
      "db",
      "psql",
      "-U",
      "catalog_admin",
      "-d",
      database,
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
    ],
    { input: text },
  );
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function protectedSnapshot() {
  const result = {};
  for (const name of [
    ".env.local",
    "private/catalog.sqlite",
    "private/catalog.sqlite-wal",
    "private/catalog.sqlite-shm",
  ]) {
    try {
      result[name] = hash(await readFile(name));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return result;
}
const before = await protectedSnapshot();
let base, cookie;
async function api(route, method = "GET", data, extraHeaders = {}) {
  const response = await fetch(base + route, {
    method,
    headers: {
      origin,
      ...(cookie ? { cookie } : {}),
      ...(data && typeof data !== "string" && !Buffer.isBuffer(data)
        ? { "content-type": "application/json" }
        : {}),
      ...extraHeaders,
    },
    body:
      data === undefined
        ? undefined
        : Buffer.isBuffer(data) || typeof data === "string"
          ? data
          : JSON.stringify(data),
    signal: AbortSignal.timeout(30000),
  });
  return response;
}
async function catalog() {
  const response = await api("/api/catalog");
  assert.equal(response.status, 200);
  return response.json();
}
async function save(value) {
  const response = await api("/api/catalog", "PUT", value);
  assert.equal(response.status, 200, await response.clone().text());
  return response.json();
}
async function waitApp() {
  base = "http://" + (await compose(["port", "app", "3000"])).trim();
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await api("/api/health")).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("La app no recupero salud");
}
console.log(
  `Proyecto sintetico: ${project}. Informe: ${path.join(directory, "report.json")}`,
);
try {
  const config = JSON.parse(await compose(["config", "--format", "json"]));
  assert.equal(config.name, project);
  assert.equal(config.services.app.ports.length, 1);
  assert.equal(config.services.app.ports[0].host_ip, "127.0.0.1");
  assert.ok(!config.services.db.ports?.length);
  for (const name of secretNames)
    assert.equal(
      path.resolve(config.secrets[name].file),
      path.join(directory, name),
    );
  for (const volume of Object.values(config.volumes))
    assert.ok(volume.name.startsWith(project + "_"));
  check(
    "Compose aislado: secretos temporales, volúmenes nuevos, puerto loopback y PostgreSQL privado",
  );
  await compose(["build", "app"], { stream: true });
  check("Build Docker real y comprobación de empaquetado");
  await compose(["up", "-d", "--wait", "--wait-timeout", "120"], {
    stream: true,
  });
  await waitApp();
  assert.equal((await api("/api/catalog")).status, 401);
  const login = await api("/api/auth", "POST", { password });
  assert.equal(login.status, 200);
  assert.match(login.headers.get("set-cookie"), /HttpOnly/i);
  assert.match(login.headers.get("set-cookie"), /Secure/i);
  cookie = login.headers.get("set-cookie").split(";")[0];
  assert.equal((await api("/")).status, 200);
  let current = await catalog();
  assert.equal(current.entities.length, 0);
  const entities = ["Primera sintética", "Segunda sintética"].map((title) => ({
    id: randomUUID(),
    kind: "work",
    title,
    code: "",
    genre: "",
    year: "",
    language: "",
    lyrics: "",
    notes: "",
    url: "",
    sourceUrls: [],
    publication: "unchecked",
  }));
  const registrations = entities.map((entity) => ({
    id: randomUUID(),
    entityId: entity.id,
    agency: "PRO",
    organization: "Sociedad Sintética",
    status: "unchecked",
    applicable: "unknown",
    evidenceUrl: "",
    verifiedAt: "",
    notes: "",
    sourceValues: [],
  }));
  current = await save({ ...current, entities, registrations });
  const stale = structuredClone(current);
  current.registrations[1].organization = "  sociedad   SINTÉTICA ";
  current = await save(current);
  assert.equal(
    current.proOrganizations.filter((name) => name === "Sociedad Sintética")
      .length,
    1,
  );
  assert.equal(current.registrations[1].organization, "Sociedad Sintética");
  assert.equal((await api("/api/catalog", "PUT", stale)).status, 409);
  assert.equal(
    (
      await api("/api/catalog", "PUT", current, {
        origin: "https://other.test",
      })
    ).status,
    403,
  );
  check(
    "App con PostgreSQL: login, dos canciones, PRO deduplicado, revisión concurrente y Origin",
  );

  // Simula el esquema anterior exclusivamente en la base sintética recién creada.
  await compose(["stop", "app"]);
  await sql(
    "DROP TABLE pro_organizations; DROP INDEX registration_entity_organization; ALTER TABLE registrations ADD CONSTRAINT registrations_entity_id_agency_key UNIQUE(entity_id,agency);",
  );
  for (let repeat = 0; repeat < 2; repeat++) {
    for (const name of [
      "002-registration-organizations.sql",
      "003-pro-organizations.sql",
    ])
      await sql(
        await readFile(path.join(root, "database/migrations", name), "utf8"),
      );
  }
  await compose(["start", "app"]);
  await waitApp();
  current = await catalog();
  assert.deepEqual(
    current.registrations.map((row) => row.id).sort(),
    registrations.map((row) => row.id).sort(),
  );
  assert.ok(current.proOrganizations.includes("Sociedad Sintética"));
  current.registrations.push({
    ...registrations[0],
    id: randomUUID(),
    organization: "ASCAP",
  });
  current = await save(current);
  current.registrations = [];
  current.proOrganizations = [];
  current = await save(current);
  assert.ok(current.proOrganizations.includes("Sociedad Sintética"));
  check(
    "Migraciones 002/003 reales e idempotentes, IDs conservados, varias sociedades y lista independiente",
  );

  const bytes = Buffer.from(
    "Letra de prueba Docker, sin datos reales.\n",
    "utf8",
  );
  const params = new URLSearchParams({
    entityId: entities[0].id,
    kind: "lyrics",
    name: "Letra sintética",
    filename: "letra.txt",
  });
  const upload = await api("/api/documents/upload?" + params, "POST", bytes);
  assert.equal(upload.status, 200, await upload.clone().text());
  current = await upload.json();
  let document = current.documents[0];
  assert.equal(
    hash(
      Buffer.from(
        await (await api(`/api/documents/${document.id}`)).arrayBuffer(),
      ),
    ),
    hash(bytes),
  );
  assert.equal(
    (await api(`/api/documents/${document.id}?mode=read`)).status,
    200,
  );
  const appId = await compose(["ps", "-q", "app"]);
  const inspection = JSON.parse(await command(["inspect", appId]))[0];
  assert.equal(inspection.Config.User, "node");
  assert.equal(inspection.HostConfig.ReadonlyRootfs, true);
  const filesVolume = inspection.Mounts.find(
    (mount) => mount.Destination === "/data/files",
  );
  assert.equal(filesVolume.Name, project + "_catalog_files");
  await compose(["restart", "db", "app"]);
  await waitApp();
  current = await catalog();
  assert.ok(current.proOrganizations.includes("Sociedad Sintética"));
  assert.equal(
    hash(
      Buffer.from(
        await (await api(`/api/documents/${document.id}`)).arrayBuffer(),
      ),
    ),
    hash(bytes),
  );
  check(
    "Volumen privado escribible por node, root read-only y datos/originales persistentes tras reinicio",
  );

  const backup = await api("/api/backup");
  assert.equal(backup.status, 200);
  const zip = Buffer.from(await backup.arrayBuffer());
  await writeFile(path.join(directory, "synthetic-backup.zip"), zip);
  await save({
    ...current,
    entities: [],
    links: [],
    registrations: [],
    credits: [],
    documents: [],
  });
  const restore = await api("/api/backup", "POST", zip);
  assert.equal(restore.status, 200, await restore.clone().text());
  current = await restore.json();
  assert.equal(current.entities.length, 2);
  document = current.documents[0];
  assert.equal(
    hash(
      Buffer.from(
        await (await api(`/api/documents/${document.id}`)).arrayBuffer(),
      ),
    ),
    hash(bytes),
  );
  check("Backup/restauración ZIP reales con PostgreSQL y SHA-256 del original");

  await compose(["stop", "app"]);
  await compose([
    "exec",
    "-T",
    "db",
    "pg_dump",
    "-U",
    "catalog_admin",
    "-d",
    "catalog",
    "-Fc",
    "-f",
    "/tmp/synthetic.dump",
  ]);
  await compose([
    "cp",
    "db:/tmp/synthetic.dump",
    path.join(directory, "synthetic.dump"),
  ]);
  await compose([
    "exec",
    "-T",
    "db",
    "createdb",
    "-U",
    "catalog_admin",
    "-O",
    "catalog_app",
    "restore_check",
  ]);
  await compose([
    "exec",
    "-T",
    "db",
    "pg_restore",
    "-U",
    "catalog_admin",
    "--exit-on-error",
    "-d",
    "restore_check",
    "/tmp/synthetic.dump",
  ]);
  assert.equal(
    (await sql("SELECT count(*) FROM entities;", "restore_check")).trim(),
    "2",
  );
  const restoredFiles = project + "_restored_files";
  await command([
    "volume",
    "create",
    "--label",
    `com.docker.compose.project=${project}`,
    restoredFiles,
  ]);
  await command([
    "run",
    "--rm",
    "--user",
    "0",
    "--network",
    "none",
    "--mount",
    `type=volume,source=${filesVolume.Name},target=/source,readonly`,
    "--mount",
    `type=volume,source=${restoredFiles},target=/restore`,
    image,
    "node",
    "-e",
    "const fs=require('fs');fs.cpSync('/source','/restore',{recursive:true});function own(p){fs.chownSync(p,1000,1000);if(fs.statSync(p).isDirectory())for(const n of fs.readdirSync(p))own(p+'/'+n)}own('/restore')",
  ]);
  const restoreOverride = path.join(directory, "restore.yaml");
  await writeFile(
    restoreOverride,
    `services:\n  app:\n    environment:\n      PGDATABASE: restore_check\n    volumes:\n      - restored_files:/data/files\nvolumes:\n  restored_files:\n    external: true\n    name: ${restoredFiles}\n`,
  );
  args.push("-f", restoreOverride);
  await compose([
    "up",
    "-d",
    "--no-build",
    "--wait",
    "--wait-timeout",
    "90",
    "app",
  ]);
  await waitApp();
  current = await catalog();
  assert.equal(current.entities.length, 2);
  assert.ok(current.proOrganizations.includes("Sociedad Sintética"));
  assert.equal(
    hash(
      Buffer.from(
        await (await api(`/api/documents/${document.id}`)).arrayBuffer(),
      ),
    ),
    hash(bytes),
  );
  check(
    "pg_dump/pg_restore en otra base y copia de originales en otro volumen; app lee ambos destinos restaurados",
  );
  assert.deepEqual(await protectedSnapshot(), before);
  check("Catálogo SQLite y .env.local reales sin cambios");
  report.success = true;
} catch (error) {
  report.error = error.message;
  console.error(error.message);
  process.exitCode = 1;
} finally {
  // Solo detener este proyecto; conservar sus volúmenes y backups sintéticos para diagnóstico.
  await compose(["stop"]).catch((error) => console.error(error.message));
  await writeFile(
    path.join(directory, "report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(
    `Informe: ${path.join(directory, "report.json")}. Recursos de prueba detenidos; volúmenes conservados.`,
  );
}
