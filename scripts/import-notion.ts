import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { enrichSourceCredits } from "../src/lib/import-credits";
import { releaseTypeFromSource } from "../src/lib/release-codes";
import {
  catalogSchema,
  emptyCatalog,
  mapNotionStatus,
  type Catalog,
  type Entity,
} from "../src/lib/catalog";

type Row = Record<string, string>;
const source = JSON.parse(
  await readFile("private/notion-source.json", "utf8"),
) as Record<string, { results: Row[]; has_more: boolean }>;
const distributors = existsSync("private/notion-distributors.json")
  ? (JSON.parse(
      await readFile("private/notion-distributors.json", "utf8"),
    ) as Record<string, string>)
  : {};
if (Object.values(source).some((s) => s.has_more))
  throw new Error(
    "Exportación incompleta: recupera las páginas restantes antes de importar.",
  );
const clean = (s: string | undefined) =>
  (s ?? "")
    .replace(/\*\*/g, "")
    .replace(/\\([\[\]])/g, "$1")
    .trim();
const relations = (r: Row, key: string): string[] => {
  try {
    return JSON.parse(r[key] || "[]");
  } catch {
    return [];
  }
};
const uuid = (url: string) => {
  const s = url.split("/").pop()!.replace(/-/g, "");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
};
const catalog: Catalog = structuredClone(emptyCatalog);
catalog.importedAt = new Date().toISOString();
const mapping = new Map<string, string>();
const grouped = new Map<string, Row[]>();
for (const row of source.works.results) {
  const key = clean(row.ISWC) || row.url;
  grouped.set(key, [...(grouped.get(key) ?? []), row]);
}
const base = (
  row: Row,
  kind: Entity["kind"],
  title: string,
  code: string,
): Entity => ({
  id: uuid(row.url),
  kind,
  title: clean(title),
  code: clean(code),
  genre: row.Genre ?? "",
  year:
    row["Creation Year"] ??
    row["Recording Year"] ??
    row["Production Year"] ??
    "",
  language: row.Lyrics ?? row["Metadata Language"] ?? "",
  lyrics: "",
  notes: "",
  url: row["Bridge  Audio"] ?? row["userDefined:URL"] ?? "",
  sourceUrls: [row.url],
  sourceRecords: [row],
  publication: "unchecked",
});
function addRegistration(entityId: string, agency: string, values: string[]) {
  const unique = [...new Set(values.map((v) => v || "(vacío)"))];
  const states = [...new Set(values.map(mapNotionStatus))];
  const status = states.length === 1 ? states[0] : "unchecked";
  const known = values.some((v) =>
    [
      "Registered",
      "Done",
      "Not registered",
      "Not started",
      "En progreso",
      "In progress",
      "__YES__",
    ].includes(v),
  );
  catalog.registrations.push({
    id: randomUUID(),
    entityId,
    agency,
    status,
    applicable: known ? "yes" : "unknown",
    evidenceUrl: "",
    verifiedAt: "",
    sourceValues: unique,
    notes:
      states.length > 1
        ? "Las fichas de origen declaran estados distintos. Requiere revisión."
        : agency === "Propiedad intelectual"
          ? "El país indicado en Notion no acredita un registro ni un certificado."
          : "",
  });
}
for (const group of grouped.values()) {
  const row =
    group.find((r) => !/(remaster|reparto)/i.test(r["Title (Main title)"])) ??
    group[0];
  const entity = base(row, "work", row["Title (Main title)"], row.ISWC);
  entity.sourceUrls = group.map((r) => r.url);
  entity.sourceRecords = group;
  if (group.length > 1)
    entity.notes =
      "Agrupación provisional por ISWC idéntico. Se conservan todas las fuentes y versiones; revisar las declaraciones contradictorias.";
  catalog.entities.push(entity);
  for (const r of group) mapping.set(r.url, entity.id);
  for (const [agency, key] of [
    ["PRO", "PRO "],
    ["MLC", "MLC"],
    ["Songtrust", "Songtrust"],
    ["Propiedad intelectual", "PROPIEDAD INTELECTUAL"],
  ])
    addRegistration(
      entity.id,
      agency,
      group.map((r) => r[key] ?? ""),
    );
  const writerUrls = [
    ...new Set(group.flatMap((r) => relations(r, "Writer(s)"))),
  ];
  for (const url of writerUrls)
    catalog.credits.push({
      id: randomUUID(),
      entityId: entity.id,
      name: url.endsWith("19e223b080ee81c490aff5ca09b23cdd")
        ? "David Appleton"
        : "Autor por identificar",
      role: "Autor",
      share: null,
      sourceUrl: url,
    });
}
for (const row of source.recordings.results) {
  const entity = base(row, "recording", row["Title (Main title)"], row.ISRC);
  catalog.entities.push(entity);
  mapping.set(row.url, entity.id);
  for (const [agency, key] of [
    ["SoundExchange", "SoundExchange"],
    ["Luminate", "LUMINATE"],
    ["Mediabase", "MEDIABASE"],
  ])
    addRegistration(entity.id, agency, [row[key] ?? ""]);
}
const ownReleases = source.releases.results.filter(
  (r) =>
    relations(r, "Primary / Main Artist(s)").some((u) =>
      u.endsWith("19e223b080ee81c490aff5ca09b23cdd"),
    ) || relations(r, "Composition/Work").some((u) => mapping.has(u)),
);
for (const row of ownReleases) {
  const entity = base(row, "release", row["Release Title"], row.UPC);
  entity.releaseType = releaseTypeFromSource(entity);
  entity.distributor = relations(row, "Distributor")
    .map((url) => distributors[url])
    .filter(Boolean)
    .join(", ");
  entity.year = row["date:Original Release Date: (YYYY-MM-DD):start"] ?? "";
  entity.notes = `Estado de planificación en Notion: ${row.Status ?? "sin comprobar"}. No se interpreta como confirmación de publicación.`;
  catalog.entities.push(entity);
  mapping.set(row.url, entity.id);
}
for (const row of source.videos.results) {
  const entity = base(row, "video", row.Title, row.ISRC);
  entity.notes =
    "La relación Recording/Track de Notion apunta a la propia base de vídeos. No se vincula automáticamente por título ni por ISRC. " +
    clean(row.Credits);
  catalog.entities.push(entity);
  mapping.set(row.url, entity.id);
}
function link(
  fromUrl: string,
  toUrl: string,
  relation: Catalog["links"][number]["relation"],
) {
  const fromId = mapping.get(fromUrl),
    toId = mapping.get(toUrl);
  if (
    fromId &&
    toId &&
    !catalog.links.some(
      (l) => l.fromId === fromId && l.toId === toId && l.relation === relation,
    )
  )
    catalog.links.push({ id: randomUUID(), fromId, toId, relation });
}
for (const r of source.recordings.results) {
  for (const u of relations(r, "Compositions/Works"))
    link(r.url, u, "recording_work");
  for (const u of relations(r, "Release")) link(u, r.url, "release_recording");
}
for (const r of source.works.results) {
  for (const u of relations(r, "Recordings/Tracks"))
    link(u, r.url, "recording_work");
  for (const u of relations(r, "Releases")) link(u, r.url, "release_work");
}
for (const r of ownReleases) {
  for (const u of relations(r, "Recording(s)/Track(s)"))
    link(r.url, u, "release_recording");
  for (const u of relations(r, "Composition/Work"))
    link(r.url, u, "release_work");
}
catalog.sourceSummary = `Notion: ${source.works.results.length} fichas de composición agrupadas provisionalmente en ${grouped.size} obras por ISWC idéntico; ${source.recordings.results.length} grabaciones, ${source.videos.results.length} vídeos y ${ownReleases.length} lanzamientos del artista. Inventario parcial respecto a las aproximadamente 70 canciones indicadas. Sin evidencia externa verificada. Drive aún no inventariado.`;
if (existsSync("private/notion-people.json")) {
  const people = JSON.parse(
    await readFile("private/notion-people.json", "utf8"),
  );
  catalog.credits = enrichSourceCredits(catalog, people).catalog.credits;
}
catalogSchema.parse(catalog);
await writeFile(
  "private/catalog.json",
  JSON.stringify(catalog, null, 2),
  "utf8",
);
// La copia conserva únicamente los lanzamientos del artista autorizado.
source.releases.results = ownReleases;
await writeFile(
  "private/notion-source.json",
  JSON.stringify(source, null, 2),
  "utf8",
);
process.stdout.write(catalog.sourceSummary + "\n");
