import { readFile, writeFile } from "node:fs/promises";
import { getDatabase, readCatalog, writeCatalog } from "../src/lib/database";
import {
  enrichSourceCredits,
  type SourcePerson,
} from "../src/lib/import-credits";
const people = JSON.parse(
  await readFile("private/notion-people.json", "utf8"),
) as SourcePerson[];
const database = getDatabase();
const before = readCatalog(database);
const { catalog, added } = enrichSourceCredits(before, people);
if (added) {
  await writeFile(
    `private/catalog-before-credits-${Date.now()}.json`,
    JSON.stringify(before, null, 2),
    { flag: "wx", mode: 0o600 },
  );
  writeCatalog(database, catalog);
}
process.stdout.write(
  `${added} créditos con fuente añadidos. Los datos existentes se conservan.\n`,
);
database.close();
