import assert from "node:assert/strict";
import test from "node:test";
import { emptyCatalog, type Catalog, type Entity } from "../src/lib/catalog";
import {
  importSoundExchangeCatalog,
  parseSoundExchangeCatalogCsv,
  type SoundExchangeCatalogRow,
} from "../src/lib/soundexchange-import";

const workId = "00000000-0000-4000-8000-000000000001";
const recordingId = "00000000-0000-4000-8000-000000000002";
const entity = (
  id: string,
  kind: Entity["kind"],
  title: string,
  code = "",
): Entity => ({
  id,
  kind,
  title,
  code,
  genre: "",
  year: "",
  language: "",
  lyrics: "",
  notes: "",
  url: "",
  sourceUrls: [],
  publication: "unchecked",
});
const row = (
  overrides: Partial<SoundExchangeCatalogRow> = {},
): SoundExchangeCatalogRow => ({
  Artist: "David Appleton",
  "Track Title": "Canción",
  ISRC: "ISRC1",
  SXID: "SX1",
  "Effective %": "100.0",
  Hold: "No",
  Registrant: "REGISTRANT",
  "Payee ID#": "123",
  "Association Type": "Artist",
  ...overrides,
});
const input: Catalog = {
  ...structuredClone(emptyCatalog),
  entities: [
    entity(workId, "work", "Canción"),
    entity(recordingId, "recording", "Canción", "ISRC1"),
  ],
};

test("valida el formato exportado por SoundExchange", () => {
  const csv =
    'Artist,Track Title,ISRC,SXID,Effective %,Hold,Registrant,Payee ID#,Association Type\r\nDavid Appleton,"Título, alterno",ISRC1,SX1,100.0,No,REG,1,Artist\r\n';
  const rows = parseSoundExchangeCatalogCsv(csv);
  assert.equal(rows[0]["Track Title"], "Título, alterno");
});

test("SoundExchange concilia por ISRC y conserva filas sin ISRC por SXID", () => {
  const result = importSoundExchangeCatalog(
    input,
    [row(), row({ ISRC: "", SXID: "SX2", "Track Title": "Otra" })],
    "2026-09-15T12:00:00.000Z",
  );
  assert.equal(result.enrichedRecordings, 1);
  assert.equal(result.addedRecordings, 1);
  assert.equal(result.missingIsrc, 1);
  assert.equal(result.catalog.registrations.length, 2);
  assert.equal(result.addedCredits, 2);
  assert.equal(
    result.catalog.credits.every(
      (credit) =>
        credit.role === "Intérprete principal (SoundExchange)" &&
        credit.scope === "professional" &&
        credit.share === null,
    ),
    true,
  );
  assert.equal(
    result.catalog.registrations.every(
      (registration) => registration.status === "registered",
    ),
    true,
  );
});

test("repara el título exportado y no duplica al repetir", () => {
  const source = [
    row({
      ISRC: "OTHER1",
      SXID: "SX-PIANO",
      "Track Title": "3 �tudes For Piano: No. 1",
    }),
  ];
  const first = importSoundExchangeCatalog(
    input,
    source,
    "2026-09-15T12:00:00.000Z",
  );
  const second = importSoundExchangeCatalog(
    first.catalog,
    source,
    "2026-09-15T13:00:00.000Z",
  );
  assert.equal(
    first.catalog.entities.some((item) =>
      item.title.includes("3 Études For Piano"),
    ),
    true,
  );
  assert.equal(second.addedRecordings, 0);
  assert.equal(second.addedRegistrations, 0);
  assert.equal(second.addedCredits, 0);
  assert.equal(second.catalog.entities.length, first.catalog.entities.length);
});
