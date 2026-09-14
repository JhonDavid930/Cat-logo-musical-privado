import { readFileSync } from "node:fs";
import { getDatabase, readCatalog, writeCatalog } from "../src/lib/database";
import { catalogSchema } from "../src/lib/catalog";
const seed = catalogSchema.parse(
  JSON.parse(readFileSync("private/catalog.json", "utf8")),
);
const db = getDatabase(),
  current = readCatalog(db);
const sourceById = new Map(
  seed.entities.map((entity) => [entity.id, entity.sourceRecords]),
);
writeCatalog(db, {
  ...current,
  entities: current.entities.map((entity) => ({
    ...entity,
    sourceRecords: entity.sourceRecords ?? sourceById.get(entity.id),
  })),
});
process.stdout.write(
  "Fuentes originales incorporadas sin cambiar los datos editados.\n",
);
