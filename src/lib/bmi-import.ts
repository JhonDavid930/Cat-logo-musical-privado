import { createHash } from "node:crypto";
import {
  catalogSchema,
  type Catalog,
  type Entity,
  type Registration,
} from "./catalog";
import { parseCsv } from "./csv";

export type BmiCatalogRow = {
  TitleNumber: string;
  Title: string;
  WtrPubIndicator: string;
  PubType: string;
  Participant: string;
  Share: string;
  IPNameNumber: string;
  CurrentAffliation: string;
  RegistrationDate: string;
  RegistrationOrigin: string;
  ISWCNumber: string;
  SongviewStatus: string;
};

export type BmiImportResult = {
  catalog: Catalog;
  sourceWorks: number;
  addedWorks: number;
  enrichedWorks: number;
  addedRegistrations: number;
  updatedRegistrations: number;
  addedCredits: number;
  addedLinks: number;
  duplicateIswcs: string[];
};

function deterministicUuid(key: string) {
  const bytes = createHash("sha256").update(key).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const clean = (value: string | undefined) => (value ?? "").trim();
const normalizedCode = (value: string | undefined) =>
  clean(value)
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
const normalizedTitle = (value: string | undefined) =>
  clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const unique = <T>(values: T[]) => [...new Set(values)];

function parseRegistrationDate(value: string) {
  const match = clean(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return clean(value);
  return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

function appendNote(entity: Entity, note: string) {
  if (!entity.notes.includes(note))
    entity.notes = [entity.notes.trim(), note].filter(Boolean).join("\n\n");
}

function bmiSourceRecord(row: BmiCatalogRow, importedAt: string) {
  return {
    Source: "BMI Catalog Export",
    BMITitleNumber: clean(row.TitleNumber),
    Title: clean(row.Title),
    ParticipantType: clean(row.WtrPubIndicator),
    PublisherType: clean(row.PubType),
    Participant: clean(row.Participant),
    DeclaredShare: clean(row.Share),
    IPNameNumber: clean(row.IPNameNumber),
    CurrentAffiliation: clean(row.CurrentAffliation),
    RegistrationDate: parseRegistrationDate(row.RegistrationDate),
    RegistrationOrigin: clean(row.RegistrationOrigin),
    ISWC: clean(row.ISWCNumber),
    SongviewStatus: clean(row.SongviewStatus),
    RetrievedAt: importedAt,
  };
}

function updateSourceRecords(
  entity: Entity,
  titleNumber: string,
  rows: BmiCatalogRow[],
  importedAt: string,
) {
  entity.sourceRecords = [
    ...(entity.sourceRecords ?? []).filter(
      (record) =>
        !(
          record.Source === "BMI Catalog Export" &&
          record.BMITitleNumber === titleNumber
        ),
    ),
    ...rows.map((row) => bmiSourceRecord(row, importedAt)),
  ];
}

function statusFromSongview(value: string): Registration["status"] {
  return clean(value).toLowerCase() === "reconciled"
    ? "registered"
    : "in_progress";
}

function sourceRegistrationValues(rows: BmiCatalogRow[]) {
  return unique(
    rows.flatMap((row) => [
      `BMI Title Number: ${clean(row.TitleNumber)}`,
      `Songview Status: ${clean(row.SongviewStatus)}`,
      `Registration Date: ${parseRegistrationDate(row.RegistrationDate)}`,
      `Registration Origin: ${clean(row.RegistrationOrigin)}`,
    ]),
  );
}

function newWork(row: BmiCatalogRow): Entity {
  const titleNumber = clean(row.TitleNumber);
  return {
    id: deterministicUuid(`bmi:work:${titleNumber}`),
    kind: "work",
    title: clean(row.Title),
    code: clean(row.ISWCNumber),
    genre: "",
    year: "",
    language: "",
    lyrics: "",
    notes: "",
    url: "",
    sourceUrls: [],
    publication: "unchecked",
  };
}

export function parseBmiCatalogCsv(input: string): BmiCatalogRow[] {
  const [headers, ...records] = parseCsv(input.replace(/^\uFEFF/, ""));
  const expected = [
    "TitleNumber",
    "Title",
    "WtrPubIndicator",
    "PubType",
    "Participant",
    "Share",
    "IPNameNumber",
    "CurrentAffliation",
    "RegistrationDate",
    "RegistrationOrigin",
    "ISWCNumber",
    "SongviewStatus",
  ] as const;
  if (!headers || headers.join("\u0000") !== expected.join("\u0000"))
    throw new Error("El CSV no tiene las columnas esperadas del catálogo BMI.");
  return records
    .filter((record) => record.some((value) => clean(value)))
    .map((record) => {
      if (record.length !== expected.length)
        throw new Error(
          "Una fila del CSV tiene un número de columnas inválido.",
        );
      return Object.fromEntries(
        expected.map((header, index) => [header, record[index]]),
      ) as BmiCatalogRow;
    });
}

export function importBmiCatalog(
  input: Catalog,
  rows: BmiCatalogRow[],
  importedAt: string,
): BmiImportResult {
  const catalog = structuredClone(catalogSchema.parse(input));
  const grouped = new Map<string, BmiCatalogRow[]>();
  for (const row of rows) {
    const titleNumber = clean(row.TitleNumber);
    if (!titleNumber || !clean(row.Title) || !clean(row.ISWCNumber))
      throw new Error(
        "Cada obra de BMI debe tener Title Number, título e ISWC.",
      );
    grouped.set(titleNumber, [...(grouped.get(titleNumber) ?? []), row]);
  }

  const sourceIswcs = new Map<string, string[]>();
  for (const [titleNumber, group] of grouped) {
    const iswc = normalizedCode(group[0].ISWCNumber);
    sourceIswcs.set(iswc, [...(sourceIswcs.get(iswc) ?? []), titleNumber]);
  }
  const duplicateIswcs = [...sourceIswcs]
    .filter(([, titleNumbers]) => titleNumbers.length > 1)
    .map(([iswc]) => iswc);

  const initialWorks = catalog.entities
    .filter((entity) => entity.kind === "work")
    .map((entity) => ({
      entity,
      code: normalizedCode(entity.code),
      title: normalizedTitle(entity.title),
    }));
  let addedWorks = 0;
  let enrichedWorks = 0;
  let addedRegistrations = 0;
  let updatedRegistrations = 0;
  let addedCredits = 0;
  let addedLinks = 0;
  const importedWorks: Entity[] = [];

  for (const [titleNumber, group] of grouped) {
    const first = group[0];
    const iswc = normalizedCode(first.ISWCNumber);
    let work = catalog.entities.find(
      (entity) =>
        entity.kind === "work" &&
        entity.sourceRecords?.some(
          (record) =>
            record.Source === "BMI Catalog Export" &&
            record.BMITitleNumber === titleNumber,
        ),
    );
    if (!work) {
      const byCode = initialWorks.filter((item) => item.code === iswc);
      const byTitle = initialWorks.filter(
        (item) => !item.code && item.title === normalizedTitle(first.Title),
      );
      work =
        byCode.length === 1
          ? byCode[0].entity
          : byTitle.length === 1
            ? byTitle[0].entity
            : undefined;
    }
    if (!work) {
      work = newWork(first);
      catalog.entities.push(work);
      addedWorks++;
    } else {
      if (!work.code) work.code = clean(first.ISWCNumber);
      enrichedWorks++;
    }
    importedWorks.push(work);
    updateSourceRecords(work, titleNumber, group, importedAt);
    appendNote(
      work,
      `BMI Title Number ${titleNumber}. Estado Songview: ${clean(first.SongviewStatus)}. Fecha de registro declarada por BMI: ${parseRegistrationDate(first.RegistrationDate)}.`,
    );
    if (duplicateIswcs.includes(iswc))
      appendNote(
        work,
        `El CSV de BMI asigna el mismo ISWC a varios Title Numbers (${sourceIswcs.get(iswc)!.join(", ")}); se conservan como fichas separadas hasta su revisión.`,
      );

    const status = statusFromSongview(first.SongviewStatus);
    let registration = catalog.registrations.find(
      (item) =>
        item.entityId === work!.id &&
        item.agency === "PRO" &&
        clean(item.organization).toLowerCase() === "bmi",
    );
    if (!registration) {
      registration = catalog.registrations.find(
        (item) =>
          item.entityId === work!.id &&
          item.agency === "PRO" &&
          !clean(item.organization),
      );
    }
    const registrationNote =
      "Fuente: exportación del catálogo de BMI. Reconciled se registra como completado; Pending Society Review permanece en trámite. La evidencia revisada requiere abrir un justificante independiente.";
    if (registration) {
      registration.organization = "BMI";
      if (!registration.verifiedAt) registration.status = status;
      registration.applicable = "yes";
      registration.sourceValues = unique([
        ...registration.sourceValues,
        ...sourceRegistrationValues(group),
      ]);
      if (!registration.notes.includes(registrationNote))
        registration.notes = [registration.notes.trim(), registrationNote]
          .filter(Boolean)
          .join("\n\n");
      updatedRegistrations++;
    } else {
      catalog.registrations.push({
        id: deterministicUuid(`bmi:registration:${titleNumber}`),
        entityId: work.id,
        agency: "PRO",
        organization: "BMI",
        status,
        applicable: "yes",
        evidenceUrl: "",
        verifiedAt: "",
        notes: registrationNote,
        sourceValues: sourceRegistrationValues(group),
      });
      addedRegistrations++;
    }

    for (const row of group) {
      const participant = clean(row.Participant);
      if (!participant) continue;
      const writer = clean(row.WtrPubIndicator) === "W";
      const creditId = deterministicUuid(
        `bmi:credit:${titleNumber}:${clean(row.WtrPubIndicator)}:${clean(row.IPNameNumber)}:${participant}`,
      );
      if (catalog.credits.some((credit) => credit.id === creditId)) continue;
      catalog.credits.push({
        id: creditId,
        entityId: work.id,
        name: participant,
        role: writer ? "Compositor/a (BMI)" : "Editorial musical (BMI)",
        scope: writer ? "authorship" : "professional",
        share: null,
        sourceUrl: "",
      });
      addedCredits++;
    }
  }

  const worksByTitle = new Map<string, Entity[]>();
  for (const work of unique(importedWorks)) {
    const key = normalizedTitle(work.title);
    worksByTitle.set(key, [...(worksByTitle.get(key) ?? []), work]);
  }
  for (const recording of catalog.entities.filter(
    (entity) => entity.kind === "recording",
  )) {
    if (
      catalog.links.some(
        (link) =>
          link.relation === "recording_work" && link.fromId === recording.id,
      )
    )
      continue;
    const candidates = worksByTitle.get(normalizedTitle(recording.title)) ?? [];
    if (candidates.length !== 1) continue;
    catalog.links.push({
      id: deterministicUuid(
        `bmi:link:recording_work:${recording.id}:${candidates[0].id}`,
      ),
      fromId: recording.id,
      toId: candidates[0].id,
      relation: "recording_work",
    });
    addedLinks++;
  }

  catalog.importedAt = importedAt;
  const summary = ` BMI (${importedAt.slice(0, 10)}): ${grouped.size} Title Numbers y ${rows.length} participantes conciliados desde el CSV oficial; los porcentajes se conservan como fuente sin reinterpretarlos.`;
  catalog.sourceSummary =
    `${catalog.sourceSummary.replace(/ BMI \([^)]*\):.*$/s, "").trim()}${summary}`.slice(
      0,
      2000,
    );
  return {
    catalog: catalogSchema.parse(catalog),
    sourceWorks: grouped.size,
    addedWorks,
    enrichedWorks,
    addedRegistrations,
    updatedRegistrations,
    addedCredits,
    addedLinks,
    duplicateIswcs,
  };
}
