import "server-only";
import { getDatabase, readCatalog, writeCatalog } from "./database";
import { readPostgres, writePostgres } from "./postgres";
import type { Catalog } from "./catalog";
export const loadCatalog = async () =>
  process.env.CATALOG_STORAGE === "postgres"
    ? readPostgres()
    : readCatalog(getDatabase());
export const saveCatalog = async (catalog: Catalog) =>
  process.env.CATALOG_STORAGE === "postgres"
    ? writePostgres(catalog)
    : writeCatalog(getDatabase(), catalog);
