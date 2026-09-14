import { existsSync, readdirSync } from "node:fs";
const directory = ".next/standalone";
if (!existsSync(directory)) throw new Error("Falta el Build standalone.");
const forbidden = [
  "private",
  "cover-art",
  "invoices",
  "music-analysis",
  ".tools",
  "test-results",
];
const unexpected = readdirSync(directory).filter(
  (name) => forbidden.includes(name) || name.startsWith(".env"),
);
if (unexpected.length)
  throw new Error(
    "El empaquetado contiene archivos privados y no puede distribuirse.",
  );
process.stdout.write(
  "Empaquetado comprobado: sin datos privados ni archivos de entorno.\n",
);
