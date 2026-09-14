import { createHash } from "node:crypto";
import { catalogSchema, type Catalog, type Entity } from "./catalog";
import { parseCsv } from "./csv";

export type SoundExchangeCatalogRow = {
  Artist: string;
  "Track Title": string;
  ISRC: string;
  SXID: string;
  "Effective %": string;
  Hold: string;
  Registrant: string;
  "Payee ID#": string;
  "Association Type": string;
};

export type SoundExchangeImportResult = {
  catalog: Catalog;
  sourceRows: number;
  addedRecordings: number;
  enrichedRecordings: number;
  addedRegistrations: number;
  updatedRegistrations: number;
  addedCredits: number;
  addedLinks: number;
  missingIsrc: number;
};

const legacyHomonymNote =
  "Revisión prioritaria: el título de repertorio clásico podría pertenecer a otro artista con el mismo nombre. Se conserva porque figura en la exportación asociada de SoundExchange.";

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

function displayTitle(value: string) {
  return clean(value)
    .replace(/Biling�e/gi, "Bilingüe")
    .replace(/All� Estar�/gi, "Allí Estaré")
    .replace(/Lamentar�s/gi, "Lamentarás")
    .replace(/Tu Aqu� Yo All�/gi, "Tu Aquí Yo Allá")
    .replace(/�tudes/gi, "Études");
}

function appendNote(entity: Entity, note: string) {
  if (!entity.notes.includes(note))
    entity.notes = [entity.notes.trim(), note].filter(Boolean).join("\n\n");
}

function removeLegacyHomonymNote(entity: Entity) {
  entity.notes = entity.notes
    .split("\n\n")
    .filter((note) => note !== legacyHomonymNote)
    .join("\n\n");
}

function sourceRecord(row: SoundExchangeCatalogRow, importedAt: string) {
  return {
    Source: "SoundExchange Artist Catalog",
    Artist: clean(row.Artist),
    TrackTitle: clean(row["Track Title"]),
    ISRC: clean(row.ISRC),
    SXID: clean(row.SXID),
    EffectivePercent: clean(row["Effective %"]),
    Hold: clean(row.Hold),
    Registrant: clean(row.Registrant),
    PayeeId: clean(row["Payee ID#"]),
    AssociationType: clean(row["Association Type"]),
    RetrievedAt: importedAt,
  };
}

function updateSourceRecord(
  entity: Entity,
  row: SoundExchangeCatalogRow,
  importedAt: string,
) {
  const sxid = clean(row.SXID);
  entity.sourceRecords = [
    ...(entity.sourceRecords ?? []).filter(
      (record) =>
        !(
          record.Source === "SoundExchange Artist Catalog" &&
          record.SXID === sxid
        ),
    ),
    sourceRecord(row, importedAt),
  ];
}

function newRecording(row: SoundExchangeCatalogRow): Entity {
  return {
    id: deterministicUuid(`soundexchange:recording:${clean(row.SXID)}`),
    kind: "recording",
    title: displayTitle(row["Track Title"]),
    code: normalizedCode(row.ISRC),
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

export function parseSoundExchangeCatalogCsv(
  input: string,
): SoundExchangeCatalogRow[] {
  const [headers, ...records] = parseCsv(input.replace(/^\uFEFF/, ""));
  const expected = [
    "Artist",
    "Track Title",
    "ISRC",
    "SXID",
    "Effective %",
    "Hold",
    "Registrant",
    "Payee ID#",
    "Association Type",
  ] as const;
  if (!headers || headers.join("\u0000") !== expected.join("\u0000"))
    throw new Error(
      "El CSV no tiene las columnas esperadas del catálogo de SoundExchange.",
    );
  return records
    .filter((record) => record.some((value) => clean(value)))
    .map((record) => {
      if (record.length !== expected.length)
        throw new Error(
          "Una fila del CSV tiene un número de columnas inválido.",
        );
      const row = Object.fromEntries(
        expected.map((header, index) => [header, record[index]]),
      ) as SoundExchangeCatalogRow;
      if (!clean(row.SXID) || !clean(row["Track Title"]))
        throw new Error("Cada fila de SoundExchange debe tener SXID y título.");
      return row;
    });
}

export function importSoundExchangeCatalog(
  input: Catalog,
  rows: SoundExchangeCatalogRow[],
  importedAt: string,
): SoundExchangeImportResult {
  const catalog = structuredClone(catalogSchema.parse(input));
  const sxids = new Set<string>();
  for (const row of rows) {
    const sxid = clean(row.SXID);
    if (sxids.has(sxid)) throw new Error(`El SXID ${sxid} aparece duplicado.`);
    sxids.add(sxid);
  }
  const initialRecordings = catalog.entities
    .filter((entity) => entity.kind === "recording")
    .map((entity) => ({
      entity,
      code: normalizedCode(entity.code),
      title: normalizedTitle(entity.title),
    }));
  let addedRecordings = 0;
  let enrichedRecordings = 0;
  let addedRegistrations = 0;
  let updatedRegistrations = 0;
  let addedCredits = 0;
  let addedLinks = 0;

  for (const row of rows) {
    const sxid = clean(row.SXID);
    const isrc = normalizedCode(row.ISRC);
    let recording = catalog.entities.find(
      (entity) =>
        entity.kind === "recording" &&
        entity.sourceRecords?.some(
          (record) =>
            record.Source === "SoundExchange Artist Catalog" &&
            record.SXID === sxid,
        ),
    );
    if (!recording && isrc) {
      const matches = initialRecordings.filter((item) => item.code === isrc);
      if (matches.length === 1) recording = matches[0].entity;
    }
    if (!recording && !isrc) {
      const title = normalizedTitle(displayTitle(row["Track Title"]));
      const matches = initialRecordings.filter((item) => item.title === title);
      if (matches.length === 1) recording = matches[0].entity;
    }
    if (!recording) {
      recording = newRecording(row);
      catalog.entities.push(recording);
      addedRecordings++;
    } else enrichedRecordings++;
    removeLegacyHomonymNote(recording);
    updateSourceRecord(recording, row, importedAt);
    appendNote(
      recording,
      `SoundExchange SXID ${sxid}. Asociación ${clean(row["Association Type"])}; participación efectiva declarada ${clean(row["Effective %"])} %; Hold: ${clean(row.Hold)}.`,
    );
    let registration = catalog.registrations.find(
      (item) =>
        item.entityId === recording!.id && item.agency === "SoundExchange",
    );
    const status =
      clean(row.Hold).toLowerCase() === "no" ? "registered" : "in_progress";
    const values = [
      `SXID: ${sxid}`,
      `Association Type: ${clean(row["Association Type"])}`,
      `Effective %: ${clean(row["Effective %"])}`,
      `Hold: ${clean(row.Hold)}`,
    ];
    const note =
      "Fuente: exportación del Artist Catalog de SoundExchange. La ficha queda declarada; la evidencia revisada requiere abrir un justificante independiente.";
    if (registration) {
      if (!registration.verifiedAt) registration.status = status;
      registration.applicable = "yes";
      registration.sourceValues = unique([
        ...registration.sourceValues,
        ...values,
      ]);
      if (!registration.notes.includes(note))
        registration.notes = [registration.notes.trim(), note]
          .filter(Boolean)
          .join("\n\n");
      updatedRegistrations++;
    } else {
      registration = {
        id: deterministicUuid(`soundexchange:registration:${sxid}`),
        entityId: recording.id,
        agency: "SoundExchange",
        status,
        applicable: "yes",
        evidenceUrl: "",
        verifiedAt: "",
        notes: note,
        sourceValues: values,
      };
      catalog.registrations.push(registration);
      addedRegistrations++;
    }

    const artist = clean(row.Artist);
    const creditId = deterministicUuid(
      `soundexchange:credit:${recording.id}:${artist.toLowerCase()}`,
    );
    if (!catalog.credits.some((credit) => credit.id === creditId)) {
      catalog.credits.push({
        id: creditId,
        entityId: recording.id,
        name: artist,
        role: "Intérprete principal (SoundExchange)",
        scope: "professional",
        share: null,
        sourceUrl: "",
      });
      addedCredits++;
    }
  }

  const worksByTitle = new Map<string, Entity[]>();
  for (const work of catalog.entities.filter(
    (entity) => entity.kind === "work",
  )) {
    const title = normalizedTitle(work.title);
    worksByTitle.set(title, [...(worksByTitle.get(title) ?? []), work]);
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
        `soundexchange:link:recording_work:${recording.id}:${candidates[0].id}`,
      ),
      fromId: recording.id,
      toId: candidates[0].id,
      relation: "recording_work",
    });
    addedLinks++;
  }

  catalog.importedAt = importedAt;
  const missingIsrc = rows.filter((row) => !normalizedCode(row.ISRC)).length;
  const summary = ` SoundExchange (${importedAt.slice(0, 10)}): ${rows.length} SXID conciliados; ${missingIsrc} filas sin ISRC. El propietario confirmó que David Appleton es su nombre artístico como intérprete y Jhon David Valdez Calier su nombre legal.`;
  catalog.sourceSummary =
    `${catalog.sourceSummary.replace(/ SoundExchange \([^)]*\):.*$/s, "").trim()}${summary}`.slice(
      0,
      2000,
    );
  return {
    catalog: catalogSchema.parse(catalog),
    sourceRows: rows.length,
    addedRecordings,
    enrichedRecordings,
    addedRegistrations,
    updatedRegistrations,
    addedCredits,
    addedLinks,
    missingIsrc,
  };
}
