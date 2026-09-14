import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  catalogSchema,
  emptyCatalog,
  progress,
  type Entity,
  type Registration,
} from "../src/lib/catalog";
import {
  changedReleaseCodeIssue,
  upcIssue,
  releaseIds,
  releaseTypeFromSource,
} from "../src/lib/release-codes";
import { openDatabase, readCatalog, writeCatalog } from "../src/lib/database";
import { registrationLabel } from "../src/lib/registration-label";
const song: Entity = {
  id: randomUUID(),
  kind: "work",
  title: "Prueba",
  code: "",
  genre: "",
  year: "",
  language: "",
  lyrics: "",
  notes: "",
  url: "",
  sourceUrls: [],
  publication: "unchecked",
};
test("la migración de registros conserva las filas antiguas y admite sociedades distintas", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "da-registration-migration-"),
  );
  const filename = path.join(directory, "catalog.sqlite");
  let db = openDatabase(filename);
  db.exec(
    "DROP TABLE registrations; CREATE TABLE registrations (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL REFERENCES entities(id), agency TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)), UNIQUE(entity_id,agency));",
  );
  const original: Registration = {
    id: randomUUID(),
    entityId: song.id,
    agency: "PRO",
    status: "registered",
    applicable: "yes",
    evidenceUrl: "https://example.com/certificate",
    verifiedAt: "2026-09-10T00:00:00.000Z",
    notes: "Texto original",
    sourceValues: ["Registered"],
  };
  const saved = writeCatalog(db, {
    ...structuredClone(emptyCatalog),
    entities: [song],
    registrations: [original],
  });
  db.close();
  db = openDatabase(filename);
  const migrated = readCatalog(db);
  assert.deepEqual(migrated, saved);
  migrated.registrations[0].organization = "BMI";
  migrated.registrations.push({
    ...original,
    id: randomUUID(),
    organization: "ASCAP",
  });
  writeCatalog(db, migrated);
  assert.equal(readCatalog(db).registrations.length, 2);
  db.close();
});
test("UPC/EAN comprueba control y conserva ceros y valores de origen irregulares", () => {
  for (const value of ["", "036000291452", "0036000291452", "6291041500213"])
    assert.equal(upcIssue(value), null);
  for (const value of [
    "036000291453",
    "123",
    "036 000291452",
    "ABC000291452",
    "00036000291452",
  ])
    assert.ok(upcIssue(value));
  const catalog = {
    ...structuredClone(emptyCatalog),
    entities: [
      {
        ...song,
        kind: "release" as const,
        code: "irregular",
        sourceRecords: [{ UPC: "**irregular**", Type: "Album" }],
      },
    ],
  };
  assert.equal(changedReleaseCodeIssue(catalog, emptyCatalog), null);
  assert.equal(releaseTypeFromSource(catalog.entities[0]), "album");
  const changed = structuredClone(catalog);
  changed.entities[0].code = "1234";
  assert.ok(changedReleaseCodeIssue(changed, catalog));
});
test("un álbum compartido y varios lanzamientos por canción persisten sin duplicación", () => {
  const second = { ...song, id: randomUUID(), title: "Segunda canción" };
  const album = {
    ...song,
    id: randomUUID(),
    kind: "release" as const,
    title: "Álbum compartido",
    code: "0036000291452",
    releaseType: "album" as const,
  };
  const single = {
    ...album,
    id: randomUUID(),
    title: "Single",
    code: "036000291452",
    releaseType: "single" as const,
  };
  const catalog = {
    ...structuredClone(emptyCatalog),
    entities: [song, second, album, single],
    links: [
      {
        id: randomUUID(),
        fromId: album.id,
        toId: song.id,
        relation: "release_work" as const,
      },
      {
        id: randomUUID(),
        fromId: album.id,
        toId: second.id,
        relation: "release_work" as const,
      },
      {
        id: randomUUID(),
        fromId: single.id,
        toId: song.id,
        relation: "release_work" as const,
      },
    ],
  };
  const db = openDatabase(":memory:");
  writeCatalog(db, catalog);
  const saved = readCatalog(db);
  assert.equal(
    saved.entities.find((entity) => entity.id === album.id)!.code,
    "0036000291452",
  );
  assert.equal(
    saved.entities.find((entity) => entity.id === album.id)!.releaseType,
    "album",
  );
  assert.equal(releaseIds(saved, song).size, 2);
  assert.equal(releaseIds(saved, second).size, 1);
  db.close();
});
test("especificar BMI conserva el registro y no duplica progreso; admite varias sociedades", () => {
  const registration: Registration = {
    id: randomUUID(),
    entityId: song.id,
    agency: "PRO",
    status: "registered",
    applicable: "yes",
    evidenceUrl: "https://example.com/evidence",
    verifiedAt: "2026-09-10T00:00:00.000Z",
    notes: "Original",
    sourceValues: ["Registered"],
  };
  const before = {
    ...structuredClone(emptyCatalog),
    entities: [song],
    registrations: [registration],
  };
  const after = structuredClone(before);
  after.registrations[0].organization = "BMI";
  assert.equal(registrationLabel(after.registrations[0]), "PRO · BMI");
  assert.deepEqual(
    progress(after.registrations),
    progress(before.registrations),
  );
  assert.equal(after.registrations[0].id, registration.id);
  assert.equal(after.registrations[0].verifiedAt, registration.verifiedAt);
  const db = openDatabase(":memory:");
  writeCatalog(db, after);
  assert.equal(readCatalog(db).registrations[0].organization, "BMI");
  db.close();
  after.registrations.push({
    ...registration,
    id: randomUUID(),
    organization: "ASCAP",
  });
  assert.equal(catalogSchema.safeParse(after).success, true);
  const multiple = openDatabase(":memory:");
  writeCatalog(multiple, after);
  assert.equal(readCatalog(multiple).registrations.length, 2);
  multiple.close();
  after.registrations.push({ ...registration, id: randomUUID() });
  assert.equal(catalogSchema.safeParse(after).success, false);
});
