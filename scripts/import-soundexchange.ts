import { readFile } from "node:fs/promises";
import { openDatabase, readCatalog, writeCatalog } from "../src/lib/database";
import {
  importSoundExchangeCatalog,
  parseSoundExchangeCatalogCsv,
} from "../src/lib/soundexchange-import";

const positionalArguments = process.argv
  .slice(2)
  .filter((value) => !value.startsWith("--"));
const sourcePath =
  positionalArguments[0] ?? "private/soundexchange/artist-catalog.csv";
const databasePath = positionalArguments[1] ?? "private/catalog.sqlite";
const apply = process.argv.includes("--apply");
const rows = parseSoundExchangeCatalogCsv(await readFile(sourcePath, "utf8"));
const database = openDatabase(databasePath);

try {
  const current = readCatalog(database);
  const result = importSoundExchangeCatalog(
    current,
    rows,
    new Date().toISOString(),
  );
  const output = apply
    ? writeCatalog(database, result.catalog)
    : result.catalog;
  process.stdout.write(
    JSON.stringify(
      {
        mode: apply ? "applied" : "preview",
        revision: output.revision,
        entities: output.entities.length,
        recordings: output.entities.filter(
          (entity) => entity.kind === "recording",
        ).length,
        registrations: output.registrations.length,
        ...Object.fromEntries(
          Object.entries(result).filter(([key]) => key !== "catalog"),
        ),
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  database.close();
}
