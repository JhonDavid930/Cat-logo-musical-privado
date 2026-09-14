import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  catalogSchema,
  emptyCatalog,
  mapNotionStatus,
  progress,
  registrationsFor,
  searchEntities,
  type Catalog,
  type Entity,
  type Registration,
} from "../src/lib/catalog";
import {
  ConflictError,
  openDatabase,
  readCatalog,
  writeCatalog,
} from "../src/lib/database";

const entity = (kind: Entity["kind"] = "work"): Entity => ({
  id: randomUUID(),
  kind,
  title: "Bilingüe",
  code: "T-315.832.610-0",
  genre: "Afrobeat",
  year: "2023",
  language: "Spanish",
  lyrics: "",
  notes: "",
  url: "",
  sourceUrls: [],
  publication: "unchecked",
});
const registration = (
  entityId: string,
  status: Registration["status"] = "registered",
  applicable: Registration["applicable"] = "yes",
): Registration => ({
  id: randomUUID(),
  entityId,
  agency: "PRO",
  status,
  applicable,
  evidenceUrl: "",
  verifiedAt: "",
  notes: "",
  sourceValues: [],
});
const fixture = (): Catalog => {
  const work = entity();
  return {
    ...structuredClone(emptyCatalog),
    entities: [work],
    registrations: [registration(work.id)],
  };
};
test("el denominador excluye no aplica y aplicabilidad desconocida", () => {
  const id = randomUUID();
  const p = progress([
    registration(id),
    registration(id, "pending"),
    registration(id, "not_applicable", "no"),
    registration(id, "registered", "unknown"),
  ]);
  assert.equal(p.total, 2);
  assert.equal(p.declaredPercent, 50);
  assert.equal(p.unknown, 1);
});
test("ningún registro aplicable devuelve null, nunca 100 ni NaN", () => {
  assert.equal(progress([]).declaredPercent, null);
  assert.equal(
    progress([registration(randomUUID(), "not_applicable", "no")])
      .verifiedPercent,
    null,
  );
});
test("un estado declarado o enlace por sí solo no verifica evidencia", () => {
  const r = registration(randomUUID());
  assert.equal(progress([r]).verified, 0);
  r.evidenceUrl = "https://example.com/certificate.pdf";
  assert.equal(progress([r]).verified, 0);
  r.verifiedAt = new Date().toISOString();
  assert.equal(progress([r]).verified, 1);
});
test("código ISWC presente no crea un registro completado", () => {
  assert.equal(mapNotionStatus("T-315.832.610-0"), "unchecked");
  assert.equal(mapNotionStatus(""), "unchecked");
  assert.equal(mapNotionStatus("__NO__"), "unchecked");
});
test("traducción explícita de estados Notion", () => {
  assert.equal(mapNotionStatus("Not registered"), "pending");
  assert.equal(mapNotionStatus("Not started"), "pending");
  assert.equal(mapNotionStatus("En progreso"), "in_progress");
  assert.equal(mapNotionStatus("__YES__"), "registered");
});
test("impide evidencia verificada sin justificante", () => {
  const c = fixture();
  c.registrations[0].verifiedAt = new Date().toISOString();
  assert.equal(catalogSchema.safeParse(c).success, false);
});
test("impide estado no aplica con aplicabilidad contradictoria", () => {
  const c = fixture();
  c.registrations[0].status = "not_applicable";
  assert.equal(catalogSchema.safeParse(c).success, false);
});
test("rechaza enlaces ejecutables e inseguros", () => {
  for (const url of [
    "javascript:alert(1)",
    "http://example.com",
    "https://user:pass@example.com",
  ]) {
    const c = fixture();
    c.entities[0].url = url;
    assert.equal(catalogSchema.safeParse(c).success, false);
  }
});
test("repartos desconocidos se mantienen nulos y no pueden superar 100", () => {
  const c = fixture();
  c.credits = [
    {
      id: randomUUID(),
      entityId: c.entities[0].id,
      name: "Autor",
      role: "Autor",
      share: null,
      sourceUrl: "",
    },
  ];
  assert.equal(catalogSchema.safeParse(c).success, true);
  c.credits[0].share = 70;
  c.credits.push({ ...c.credits[0], id: randomUUID(), share: 40 });
  assert.equal(catalogSchema.safeParse(c).success, false);
});
test("rechaza relaciones colgantes e incompatibles", () => {
  const c = fixture();
  c.links.push({
    id: randomUUID(),
    fromId: c.entities[0].id,
    toId: randomUUID(),
    relation: "recording_work",
  });
  assert.equal(catalogSchema.safeParse(c).success, false);
  c.links[0].toId = c.entities[0].id;
  assert.equal(catalogSchema.safeParse(c).success, false);
});
test("una composición incluye registros de todas sus versiones sin duplicarlos", () => {
  const c = fixture(),
    recording = entity("recording");
  c.entities.push(recording);
  c.links.push({
    id: randomUUID(),
    fromId: recording.id,
    toId: c.entities[0].id,
    relation: "recording_work",
  });
  c.registrations.push({
    ...registration(recording.id),
    agency: "SoundExchange",
  });
  assert.equal(registrationsFor(c, c.entities[0].id).length, 2);
});
test("busca sin acentos y por código de una grabación relacionada", () => {
  const c = fixture(),
    recording = { ...entity("recording"), code: "QZTEST2600001" };
  c.entities.push(recording);
  c.links.push({
    id: randomUUID(),
    fromId: recording.id,
    toId: c.entities[0].id,
    relation: "recording_work",
  });
  assert.equal(searchEntities(c, "bilingue").length, 2);
  assert.equal(
    searchEntities(c, "QZTEST2600001").some((e) => e.kind === "work"),
    true,
  );
});
test("persistencia SQL, exportación y restauración conservan relaciones y datos", () => {
  const db = openDatabase(":memory:");
  try {
    const c = fixture();
    const saved = writeCatalog(db, c);
    assert.equal(saved.revision, 1);
    assert.deepEqual(readCatalog(db), saved);
    const backup = JSON.parse(JSON.stringify(saved));
    backup.entities[0].lyrics = "Primera línea\nSegunda línea";
    const restored = writeCatalog(db, backup);
    assert.equal(readCatalog(db).entities[0].lyrics, backup.entities[0].lyrics);
    assert.equal(restored.revision, 2);
  } finally {
    db.close();
  }
});
test("dos pestañas no pueden sobrescribir cambios silenciosamente", () => {
  const db = openDatabase(":memory:");
  try {
    const first = writeCatalog(db, fixture());
    const stale = structuredClone(first);
    writeCatalog(db, { ...first, sourceSummary: "Cambio reciente" });
    assert.throws(() => writeCatalog(db, stale), ConflictError);
    assert.equal(readCatalog(db).sourceSummary, "Cambio reciente");
  } finally {
    db.close();
  }
});
test("entrada inválida no modifica la base ni su revisión", () => {
  const db = openDatabase(":memory:");
  try {
    const valid = writeCatalog(db, fixture());
    const invalid = structuredClone(valid);
    invalid.registrations[0].entityId = randomUUID();
    assert.throws(() => writeCatalog(db, invalid));
    assert.deepEqual(readCatalog(db), valid);
  } finally {
    db.close();
  }
});
