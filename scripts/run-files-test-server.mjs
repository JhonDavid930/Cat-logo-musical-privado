import { spawn } from "node:child_process";
import { randomBytes, scryptSync } from "node:crypto";
import { mkdtemp, mkdir, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const directory = await mkdtemp(path.join(tmpdir(), "da-files-browser-"));
const salt = randomBytes(16).toString("hex");
await mkdir(".next/standalone/.next/static", { recursive: true });
await cp(".next/static", ".next/standalone/.next/static", { recursive: true });
const server = spawn(process.execPath, [".next/standalone/server.js"], {
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: "3002",
    HOSTNAME: "127.0.0.1",
    CATALOG_DATA_DIR: directory,
    CATALOG_FILES_DIR: path.join(directory, "files"),
    CATALOG_STORAGE: "sqlite",
    CATALOG_APP_URL: "http://127.0.0.1:3002",
    CATALOG_PASSWORD_HASH: `${salt}:${scryptSync("synthetic-files-test-password", salt, 64).toString("hex")}`,
    CATALOG_SESSION_SECRET: randomBytes(48).toString("hex"),
  },
  stdio: "inherit",
  windowsHide: true,
});
process.on("SIGTERM", () => server.kill());
process.on("SIGINT", () => server.kill());
server.on("exit", (code) => process.exit(code || 0));
