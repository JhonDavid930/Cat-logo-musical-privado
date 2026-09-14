import assert from "node:assert/strict";
import test from "node:test";
import { emptyCatalog, type Catalog, type Entity } from "../src/lib/catalog";
import {
  importBmiCatalog,
  parseBmiCatalogCsv,
  type BmiCatalogRow,
} from "../src/lib/bmi-import";

const existingWorkId = "00000000-0000-4000-8000-000000000001";
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
const row = (overrides: Partial<BmiCatalogRow> = {}): BmiCatalogRow => ({
  TitleNumber: "100",
  Title: "Canción",
  WtrPubIndicator: "W",
  PubType: " ",
  Participant: "AUTOR UNO",
  Share: "200.00",
  IPNameNumber: "123",
  CurrentAffliation: "BMI",
  RegistrationDate: "09/15/2026",
  RegistrationOrigin: "WORKS REGISTRATION",
  ISWCNumber: "T1234567890",
  SongviewStatus: "Reconciled",
  ...overrides,
});
const input: Catalog = {
  ...structuredClone(emptyCatalog),
  entities: [
    entity(existingWorkId, "work", "Canción"),
    entity(recordingId, "recording", "Canción", "ISRC1"),
  ],
  registrations: [
    {
      id: "00000000-0000-4000-8000-000000000003",
      entityId: existingWorkId,
      agency: "PRO",
      status: "unchecked",
      applicable: "unknown",
      evidenceUrl: "",
      verifiedAt: "",
      notes: "",
      sourceValues: [],
    },
  ],
};

test("lee campos CSV entre comillas y valida el encabezado de BMI", () => {
  const csv =
    'TitleNumber,Title,WtrPubIndicator,PubType,Participant,Share,IPNameNumber,CurrentAffliation,RegistrationDate,RegistrationOrigin,ISWCNumber,SongviewStatus\r\n100,"Título, alterno",W,,AUTOR,100,1,BMI,09/15/2026,WORKS REGISTRATION,T1,Reconciled\r\n';
  const rows = parseBmiCatalogCsv(csv);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].Title, "Título, alterno");
});

test("BMI completa obras, estados y participantes sin reinterpretar porcentajes", () => {
  const rows = [
    row(),
    row({
      WtrPubIndicator: "P",
      Participant: "EDITORIAL",
      IPNameNumber: "456",
      Share: "100.00",
    }),
    row({
      TitleNumber: "200",
      Title: "Otra",
      ISWCNumber: "T1234567890",
      SongviewStatus: "Pending Society Review",
    }),
  ];
  const result = importBmiCatalog(input, rows, "2026-09-15T12:00:00.000Z");
  assert.equal(result.sourceWorks, 2);
  assert.equal(result.addedWorks, 1);
  assert.deepEqual(result.duplicateIswcs, ["T1234567890"]);
  assert.equal(
    result.catalog.entities.filter((item) => item.kind === "work").length,
    2,
  );
  assert.equal(
    result.catalog.links.filter((item) => item.relation === "recording_work")
      .length,
    1,
  );
  assert.equal(
    result.catalog.credits.every((credit) => credit.share === null),
    true,
  );
  assert.equal(
    result.catalog.registrations.find(
      (item) => item.entityId === existingWorkId,
    )?.organization,
    "BMI",
  );
  assert.deepEqual(
    result.catalog.registrations.map((item) => item.status).sort(),
    ["in_progress", "registered"],
  );
});

test("la segunda importación de BMI no duplica fichas ni relaciones", () => {
  const first = importBmiCatalog(input, [row()], "2026-09-15T12:00:00.000Z");
  const second = importBmiCatalog(
    first.catalog,
    [row()],
    "2026-09-15T13:00:00.000Z",
  );
  assert.equal(second.addedWorks, 0);
  assert.equal(second.addedRegistrations, 0);
  assert.equal(second.addedCredits, 0);
  assert.equal(second.catalog.entities.length, first.catalog.entities.length);
  assert.equal(second.catalog.links.length, first.catalog.links.length);
});
