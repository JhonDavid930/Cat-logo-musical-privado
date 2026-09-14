import { mkdir, writeFile, access, chmod } from "node:fs/promises";
import { randomBytes, scryptSync } from "node:crypto";
const directory = "private/secrets";
try {
  await access(directory + "/session_secret");
  throw new Error("Los secretos ya existen. No se sobrescriben.");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const password = process.env.CATALOG_SETUP_PASSWORD;
if (!password || password.length < 14)
  throw new Error(
    "Define CATALOG_SETUP_PASSWORD con al menos 14 caracteres antes de ejecutar este script. No se imprimirá.",
  );
await mkdir(directory, { recursive: true, mode: 0o700 });
await chmod(directory, 0o700);
const salt = randomBytes(24).toString("hex");
for (const [name, value] of Object.entries({
  db_admin_password: randomBytes(32).toString("hex"),
  db_app_password: randomBytes(32).toString("hex"),
  catalog_password_hash:
    salt + ":" + scryptSync(password, salt, 64).toString("hex"),
  session_secret: randomBytes(48).toString("hex"),
}))
  // El directorio 0700 protege los archivos del host; el montaje individual permite lectura a los usuarios sin privilegios del contenedor.
  await writeFile(directory + "/" + name, value, { mode: 0o444, flag: "wx" });
process.stdout.write(
  "Secretos creados en private/secrets. No se muestran sus valores.\n",
);
