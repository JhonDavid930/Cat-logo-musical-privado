import Database from "better-sqlite3";
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { catalogSchema, emptyCatalog, type Catalog } from "./catalog";
import { mergeOrganizations, organizationKey } from "./pro-organizations";

export class ConflictError extends Error {}
export function openDatabase(filename: string) {
  const db = new Database(filename);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = FULL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS metadata (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, imported_at TEXT NOT NULL, source_summary TEXT NOT NULL);
    INSERT OR IGNORE INTO metadata VALUES(1,0,'','Catálogo vacío.');
    CREATE TABLE IF NOT EXISTS entities (id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('work','recording','video','release')), title TEXT NOT NULL, code TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)));
    CREATE INDEX IF NOT EXISTS entity_kind ON entities(kind);
    CREATE INDEX IF NOT EXISTS entity_code ON entities(code);
    CREATE TABLE IF NOT EXISTS links (id TEXT PRIMARY KEY, from_id TEXT NOT NULL REFERENCES entities(id), to_id TEXT NOT NULL REFERENCES entities(id), relation TEXT NOT NULL, UNIQUE(from_id,to_id,relation));
    CREATE TABLE IF NOT EXISTS registrations (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL REFERENCES entities(id), agency TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)));
    CREATE TABLE IF NOT EXISTS credits (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL REFERENCES entities(id), payload TEXT NOT NULL CHECK(json_valid(payload)));
    CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL REFERENCES entities(id), payload TEXT NOT NULL CHECK(json_valid(payload)));
    CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, revision INTEGER NOT NULL, entity_count INTEGER NOT NULL);
  `);
  db.exec("CREATE TABLE IF NOT EXISTS pro_organizations (key TEXT PRIMARY KEY, name TEXT NOT NULL)");
  db.transaction(() => {
    const existing = (db.prepare("SELECT name FROM pro_organizations ORDER BY rowid").all() as {name:string}[]).map(row=>row.name);
    const imported = (db.prepare("SELECT payload FROM registrations").all() as {payload:string}[]).map(row=>JSON.parse(row.payload)).filter(row=>row.agency === "PRO").map(row=>row.organization || "");
    const insert = db.prepare("INSERT OR IGNORE INTO pro_organizations(key,name) VALUES(?,?)");
    for (const name of mergeOrganizations(existing,imported)) insert.run(organizationKey(name),name);
  })();
  const registrationTable = db
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='registrations'",
    )
    .get() as { sql: string };
  if (/UNIQUE\s*\(entity_id\s*,\s*agency\)/i.test(registrationTable.sql)) {
    db.transaction(() =>
      db.exec(`
      CREATE TABLE registrations_migrated (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL REFERENCES entities(id), agency TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)));
      INSERT INTO registrations_migrated SELECT id,entity_id,agency,payload FROM registrations;
      DROP TABLE registrations;
      ALTER TABLE registrations_migrated RENAME TO registrations;
      CREATE UNIQUE INDEX registration_entity_organization ON registrations(entity_id,lower(agency),lower(coalesce(json_extract(payload,'$.organization'),'')));
    `),
    )();
  } else
    db.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS registration_entity_organization ON registrations(entity_id,lower(agency),lower(coalesce(json_extract(payload,'$.organization'),'')))",
    );
  return db;
}
export function readCatalog(db: Database.Database): Catalog {
  return db.transaction(() => {
    const metadata = db.prepare("SELECT * FROM metadata WHERE id=1").get() as {
      revision: number;
      imported_at: string;
      source_summary: string;
    };
    const read = (table: string) =>
      (
        db.prepare(`SELECT payload FROM ${table}`).all() as {
          payload: string;
        }[]
      ).map((r) => JSON.parse(r.payload));
    const links = db
      .prepare(
        "SELECT id, from_id AS fromId, to_id AS toId, relation FROM links",
      )
      .all();
    return catalogSchema.parse({
      version: 1,
      revision: metadata.revision,
      importedAt: metadata.imported_at,
      sourceSummary: metadata.source_summary,
      entities: read("entities"),
      links,
      registrations: read("registrations"),
      credits: read("credits"),
      documents: read("documents"),
      proOrganizations: (db.prepare("SELECT name FROM pro_organizations ORDER BY rowid").all() as {name:string}[]).map(row=>row.name),
    });
  })();
}
export function writeCatalog(db: Database.Database, input: Catalog): Catalog {
  let catalog = catalogSchema.parse(input);
  return db
    .transaction(() => {
      const current = db
        .prepare("SELECT revision FROM metadata WHERE id=1")
        .get() as { revision: number };
      if (current.revision !== catalog.revision)
        throw new ConflictError(
          "El catálogo cambió en otra ventana. Recarga antes de guardar.",
        );
      const existingOrganizations = (db.prepare("SELECT name FROM pro_organizations ORDER BY rowid").all() as {name:string}[]).map(row=>row.name);
      catalog = catalogSchema.parse({...catalog,proOrganizations:mergeOrganizations(existingOrganizations,catalog.proOrganizations)});
      const organizationStatement = db.prepare("INSERT OR IGNORE INTO pro_organizations(key,name) VALUES(?,?)");
      for (const name of catalog.proOrganizations) organizationStatement.run(organizationKey(name),name);
      db.exec(
        "DELETE FROM links; DELETE FROM registrations; DELETE FROM credits; DELETE FROM documents; DELETE FROM entities;",
      );
      const entityStatement = db.prepare(
        "INSERT INTO entities VALUES(?,?,?,?,?)",
      );
      for (const entity of catalog.entities)
        entityStatement.run(
          entity.id,
          entity.kind,
          entity.title,
          entity.code,
          JSON.stringify(entity),
        );
      const linkStatement = db.prepare("INSERT INTO links VALUES(?,?,?,?)");
      for (const link of catalog.links)
        linkStatement.run(link.id, link.fromId, link.toId, link.relation);
      const registrationStatement = db.prepare(
        "INSERT INTO registrations VALUES(?,?,?,?)",
      );
      for (const r of catalog.registrations)
        registrationStatement.run(
          r.id,
          r.entityId,
          r.agency,
          JSON.stringify(r),
        );
      for (const table of ["credits", "documents"] as const) {
        const statement = db.prepare(`INSERT INTO ${table} VALUES(?,?,?)`);
        for (const row of catalog[table])
          statement.run(row.id, row.entityId, JSON.stringify(row));
      }
      const revision = current.revision + 1;
      db.prepare(
        "UPDATE metadata SET revision=?, imported_at=?, source_summary=? WHERE id=1",
      ).run(revision, catalog.importedAt, catalog.sourceSummary);
      db.prepare(
        "INSERT INTO audit_log(created_at,revision,entity_count) VALUES(?,?,?)",
      ).run(new Date().toISOString(), revision, catalog.entities.length);
      return { ...catalog, revision };
    })
    .immediate();
}
let database: Database.Database | undefined;
export function getDatabase() {
  if (database) return database;
  const directory =
    process.env.CATALOG_DATA_DIR || path.join(process.cwd(), "private");
  mkdirSync(directory, { recursive: true });
  const filename = path.join(directory, "catalog.sqlite");
  const fresh = !existsSync(filename);
  database = openDatabase(filename);
  if (fresh) {
    const seed = path.join(directory, "catalog.json");
    if (existsSync(seed)) {
      const initial = catalogSchema.parse(
        JSON.parse(readFileSync(seed, "utf8")),
      );
      writeCatalog(database, { ...initial, revision: 0 });
    } else writeCatalog(database, emptyCatalog);
  }
  return database;
}
