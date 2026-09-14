import { Pool } from "pg";
import { readFileSync } from "node:fs";
import { catalogSchema, type Catalog } from "./catalog";
import { ConflictError } from "./database";
import { mergeOrganizations, organizationKey } from "./pro-organizations";

let pool: Pool | undefined;
export function getPool() {
  if (!pool) {
    pool = new Pool({
      host: process.env.PGHOST || "db",
      port: Number(process.env.PGPORT || 5432),
      database: process.env.PGDATABASE || "catalog",
      user: process.env.PGUSER || "catalog_app",
      password: process.env.PGPASSWORD_FILE
        ? readFileSync(process.env.PGPASSWORD_FILE, "utf8").trim()
        : process.env.PGPASSWORD,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
    pool.on("error", () => {
      process.stderr.write(
        "La conexión inactiva a PostgreSQL se interrumpió.\n",
      );
    });
  }
  return pool;
}
export async function readPostgres(): Promise<Catalog> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const metadata = (await client.query("SELECT * FROM metadata WHERE id=1"))
      .rows[0];
    const entities = (
      await client.query("SELECT payload FROM entities ORDER BY title")
    ).rows.map((r) => r.payload);
    const links = (
      await client.query(
        'SELECT id, from_id AS "fromId", to_id AS "toId", relation FROM links',
      )
    ).rows;
    const lists: Record<string, unknown[]> = {};
    const proOrganizations = (await client.query("SELECT name FROM pro_organizations ORDER BY key")).rows.map(row=>row.name);
    for (const table of ["registrations", "credits", "documents"])
      lists[table] = (
        await client.query(`SELECT payload FROM ${table}`)
      ).rows.map((r) => r.payload);
    await client.query("COMMIT");
    return catalogSchema.parse({
      version: 1,
      revision: metadata.revision,
      importedAt: metadata.imported_at,
      sourceSummary: metadata.source_summary,
      entities,
      links,
      ...lists,
      proOrganizations,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function writePostgres(input: Catalog): Promise<Catalog> {
  let catalog = catalogSchema.parse(input);
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const current = (
      await client.query("SELECT revision FROM metadata WHERE id=1 FOR UPDATE")
    ).rows[0];
    if (current.revision !== catalog.revision)
      throw new ConflictError(
        "El catálogo cambió en otra ventana. Recarga antes de guardar.",
      );
    const existingOrganizations = (await client.query("SELECT name FROM pro_organizations ORDER BY key")).rows.map(row=>row.name);
    catalog = catalogSchema.parse({...catalog,proOrganizations:mergeOrganizations(existingOrganizations,catalog.proOrganizations)});
    for (const name of catalog.proOrganizations) await client.query("INSERT INTO pro_organizations(key,name) VALUES($1,$2) ON CONFLICT(key) DO NOTHING",[organizationKey(name),name]);
    await client.query(
      "DELETE FROM links; DELETE FROM registrations; DELETE FROM credits; DELETE FROM documents; DELETE FROM entities;",
    );
    for (const entity of catalog.entities)
      await client.query(
        "INSERT INTO entities(id,kind,title,code,payload) VALUES($1,$2,$3,$4,$5)",
        [entity.id, entity.kind, entity.title, entity.code, entity],
      );
    for (const link of catalog.links)
      await client.query(
        "INSERT INTO links(id,from_id,to_id,relation) VALUES($1,$2,$3,$4)",
        [link.id, link.fromId, link.toId, link.relation],
      );
    for (const r of catalog.registrations)
      await client.query(
        "INSERT INTO registrations(id,entity_id,agency,payload) VALUES($1,$2,$3,$4)",
        [r.id, r.entityId, r.agency, r],
      );
    for (const table of ["credits", "documents"] as const)
      for (const row of catalog[table])
        await client.query(
          `INSERT INTO ${table}(id,entity_id,payload) VALUES($1,$2,$3)`,
          [row.id, row.entityId, row],
        );
    const revision = current.revision + 1;
    await client.query(
      "UPDATE metadata SET revision=$1, imported_at=$2, source_summary=$3 WHERE id=1",
      [revision, catalog.importedAt, catalog.sourceSummary],
    );
    await client.query(
      "INSERT INTO audit_log(revision,entity_count) VALUES($1,$2)",
      [revision, catalog.entities.length],
    );
    await client.query("COMMIT");
    return { ...catalog, revision };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
