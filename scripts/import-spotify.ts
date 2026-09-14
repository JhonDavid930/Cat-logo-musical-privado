import { readFile } from "node:fs/promises";
import { openDatabase, readCatalog, writeCatalog } from "../src/lib/database";
import {
  importSpotifyCatalog,
  type SpotifyCatalogSource,
} from "../src/lib/spotify-import";

const positionalArguments = process.argv
  .slice(2)
  .filter((value) => !value.startsWith("--"));
const sourcePath =
  positionalArguments[0] ?? "private/spotify-catalog-2026-09-15.json";
const databasePath = positionalArguments[1] ?? "private/catalog.sqlite";
const apply = process.argv.includes("--apply");
const source = JSON.parse(
  await readFile(sourcePath, "utf8"),
) as SpotifyCatalogSource;
const database = openDatabase(databasePath);

try {
  const current = readCatalog(database);
  const result = importSpotifyCatalog(
    current,
    source,
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
        releases: output.entities.filter((entity) => entity.kind === "release")
          .length,
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
