import { writeFile } from "node:fs/promises";
import { getDatabase, readCatalog, writeCatalog } from "../src/lib/database";
import { releaseTypeFromSource } from "../src/lib/release-codes";
const database = getDatabase();
const before = readCatalog(database);
const next = structuredClone(before);
let updated = 0;
for (const entity of next.entities)
  if (
    entity.kind === "release" &&
    !entity.releaseType &&
    releaseTypeFromSource(entity) !== "unspecified"
  ) {
    entity.releaseType = releaseTypeFromSource(entity);
    updated++;
  }
if (updated) {
  await writeFile(
    `private/catalog-before-release-types-${Date.now()}.json`,
    JSON.stringify(before, null, 2),
    { flag: "wx", mode: 0o600 },
  );
  writeCatalog(database, next);
}
process.stdout.write(
  `${updated} tipos de lanzamiento recuperados de la fuente; UPC y relaciones intactos.\n`,
);
database.close();
