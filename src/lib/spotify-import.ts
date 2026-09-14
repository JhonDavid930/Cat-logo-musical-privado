import { createHash } from "node:crypto";
import {
  catalogSchema,
  normalizeSearch,
  type Catalog,
  type Entity,
} from "./catalog";

type SpotifyArtist = { id: string; name: string };

export type SpotifyRelease = {
  id: string;
  name: string;
  album_type: string;
  release_date: string;
  total_tracks: number;
  url: string;
  artists: SpotifyArtist[];
  upc?: string;
  label?: string;
  copyrights?: Array<{ text: string; type: string }>;
  genres?: string[];
};

export type SpotifyTrackAssociation = {
  track_id: string;
  track_name: string;
  track_artists: SpotifyArtist[];
  track_url: string;
  duration_ms: number;
  disc_number: number;
  track_number: number;
  album_id: string;
  album_name: string;
  release_date: string;
  isrc?: string;
};

export type SpotifyCatalogSource = {
  source: string;
  artist: { id: string; name: string; url: string };
  market: string;
  releases: SpotifyRelease[];
  track_release_associations: SpotifyTrackAssociation[];
};

export type SpotifyImportResult = {
  catalog: Catalog;
  addedRecordings: number;
  enrichedRecordings: number;
  addedReleases: number;
  enrichedReleases: number;
  addedLinks: number;
  releaseCodeConflicts: number;
};

function deterministicUuid(key: string) {
  const bytes = createHash("sha256").update(key).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const normalized = (value: string) => normalizeSearch(value).trim();
const normalizedCode = (value: string | undefined) =>
  (value ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
const unique = <T>(values: T[]) => [...new Set(values)];
const sourceValue = (value: unknown) =>
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean" ||
  value === null
    ? value
    : JSON.stringify(value);

function sourceId(entity: Entity, key: string) {
  return entity.sourceRecords?.find((record) => record.Source === "Spotify")?.[
    key
  ];
}

function appendSourceRecord(
  entity: Entity,
  record: Record<string, unknown>,
  identityKey: string,
) {
  const prepared = Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, sourceValue(value)]),
  );
  const records = entity.sourceRecords ?? [];
  const identity = prepared[identityKey];
  const index = records.findIndex(
    (item) => item.Source === "Spotify" && item[identityKey] === identity,
  );
  entity.sourceRecords =
    index < 0
      ? [...records, prepared]
      : records.map((item, itemIndex) =>
          itemIndex === index ? { ...item, ...prepared } : item,
        );
}

function appendUrl(entity: Entity, url: string) {
  if (!entity.url) entity.url = url;
  entity.sourceUrls = unique([...entity.sourceUrls, url]).slice(0, 100);
}

function appendNote(entity: Entity, note: string) {
  if (!entity.notes.includes(note))
    entity.notes = [entity.notes.trim(), note].filter(Boolean).join("\n\n");
}

function baseTitle(title: string) {
  return normalized(
    title
      .replace(
        /\s*[([]\s*(?:\d{4}\s+)?(?:remaster(?:ed|ing)?(?:\s+version)?|acoustic\s+version|portugues\s+version)\s*[)\]]/gi,
        "",
      )
      .trim(),
  );
}

function releaseType(release: SpotifyRelease): Entity["releaseType"] {
  if (release.album_type === "album" || release.album_type === "compilation")
    return "album";
  if (release.total_tracks > 1) return "ep";
  return "single";
}

function newEntity(
  id: string,
  kind: Entity["kind"],
  title: string,
  code: string,
  year: string,
  url: string,
): Entity {
  return {
    id,
    kind,
    title,
    code,
    genre: "",
    year,
    language: "",
    lyrics: "",
    notes: "",
    url,
    sourceUrls: [url],
    publication: "published",
  };
}

export function importSpotifyCatalog(
  input: Catalog,
  source: SpotifyCatalogSource,
  importedAt: string,
): SpotifyImportResult {
  const catalog = structuredClone(catalogSchema.parse(input));
  let addedRecordings = 0;
  let enrichedRecordings = 0;
  let addedReleases = 0;
  let enrichedReleases = 0;
  let addedLinks = 0;
  let releaseCodeConflicts = 0;

  const worksByTitle = new Map<string, Entity[]>();
  for (const work of catalog.entities.filter(
    (entity) => entity.kind === "work",
  )) {
    for (const key of unique([normalized(work.title), baseTitle(work.title)]))
      worksByTitle.set(key, [...(worksByTitle.get(key) ?? []), work]);
  }

  const associationsByRecording = new Map<string, SpotifyTrackAssociation[]>();
  for (const association of source.track_release_associations) {
    const key = normalizedCode(association.isrc) || association.track_id;
    associationsByRecording.set(key, [
      ...(associationsByRecording.get(key) ?? []),
      association,
    ]);
  }

  const recordingByTrackId = new Map<string, Entity>();
  for (const group of associationsByRecording.values()) {
    const first = group[0];
    const isrc = normalizedCode(first.isrc);
    let recording = catalog.entities.find(
      (entity) =>
        entity.kind === "recording" &&
        ((isrc && normalizedCode(entity.code) === isrc) ||
          group.some(
            (item) => sourceId(entity, "SpotifyTrackId") === item.track_id,
          )),
    );
    if (!recording) {
      recording = newEntity(
        deterministicUuid(`spotify:recording:${isrc || first.track_id}`),
        "recording",
        first.track_name,
        isrc,
        first.release_date,
        first.track_url,
      );
      appendNote(
        recording,
        "Importado del catálogo público de Spotify. La plataforma identifica la grabación y su lanzamiento, pero no acredita composición, autoría ni registros legales.",
      );
      catalog.entities.push(recording);
      addedRecordings++;
    } else {
      recording.publication = "published";
      if (!recording.year) recording.year = first.release_date;
      appendUrl(recording, first.track_url);
      enrichedRecordings++;
    }
    appendSourceRecord(
      recording,
      {
        Source: "Spotify",
        SpotifyTrackId: first.track_id,
        ISRC: isrc,
        Title: first.track_name,
        Artists: unique(first.track_artists.map((artist) => artist.name)).join(
          ", ",
        ),
        DurationMs: first.duration_ms,
        AlbumIds: unique(group.map((item) => item.album_id)).join(","),
        RetrievedAt: importedAt,
      },
      "SpotifyTrackId",
    );
    for (const association of group)
      recordingByTrackId.set(association.track_id, recording);

    const alreadyLinked = catalog.links.some(
      (link) =>
        link.relation === "recording_work" && link.fromId === recording!.id,
    );
    if (!alreadyLinked) {
      const candidates = unique([
        ...(worksByTitle.get(normalized(first.track_name)) ?? []),
        ...(worksByTitle.get(baseTitle(first.track_name)) ?? []),
      ]);
      if (candidates.length === 1) {
        catalog.links.push({
          id: deterministicUuid(
            `spotify:link:recording_work:${recording.id}:${candidates[0].id}`,
          ),
          fromId: recording.id,
          toId: candidates[0].id,
          relation: "recording_work",
        });
        addedLinks++;
      }
    }
  }

  for (const release of source.releases) {
    const upc = normalizedCode(release.upc);
    const sameTitle = catalog.entities.filter(
      (entity) =>
        entity.kind === "release" &&
        normalized(entity.title) === normalized(release.name),
    );
    let releaseEntity = catalog.entities.find(
      (entity) =>
        entity.kind === "release" &&
        sourceId(entity, "SpotifyAlbumId") === release.id,
    );
    releaseEntity ??= catalog.entities.find(
      (entity) =>
        entity.kind === "release" && upc && normalizedCode(entity.code) === upc,
    );
    releaseEntity ??= sameTitle.find(
      (entity) =>
        !normalizedCode(entity.code) || normalizedCode(entity.code) === upc,
    );

    const conflictingTitleRelease =
      !releaseEntity &&
      sameTitle.find(
        (entity) =>
          normalizedCode(entity.code) && normalizedCode(entity.code) !== upc,
      );
    if (!releaseEntity) {
      releaseEntity = newEntity(
        deterministicUuid(`spotify:release:${release.id}`),
        "release",
        release.name,
        upc,
        release.release_date,
        release.url,
      );
      releaseEntity.releaseType = releaseType(release);
      releaseEntity.genre = unique(release.genres ?? []).join(", ");
      appendNote(
        releaseEntity,
        "Importado del catálogo público de Spotify; pendiente de contrastar con documentos del distribuidor.",
      );
      if (conflictingTitleRelease) {
        appendNote(
          releaseEntity,
          `Existe otra ficha con el mismo título y UPC/EAN ${conflictingTitleRelease.code}. Se conserva separada porque Spotify declara ${upc || "el código vacío"}.`,
        );
        releaseCodeConflicts++;
      }
      catalog.entities.push(releaseEntity);
      addedReleases++;
    } else {
      releaseEntity.publication = "published";
      releaseEntity.releaseType ||= releaseType(release);
      if (!releaseEntity.year) releaseEntity.year = release.release_date;
      if (!releaseEntity.genre)
        releaseEntity.genre = unique(release.genres ?? []).join(", ");
      appendUrl(releaseEntity, release.url);
      if (upc && normalizedCode(releaseEntity.code) !== upc) {
        appendNote(
          releaseEntity,
          `Spotify declara UPC ${upc}; se conserva el UPC/EAN existente ${releaseEntity.code} hasta revisar la documentación del distribuidor.`,
        );
        releaseCodeConflicts++;
      }
      enrichedReleases++;
    }
    appendSourceRecord(
      releaseEntity,
      {
        Source: "Spotify",
        SpotifyAlbumId: release.id,
        UPC: upc,
        Title: release.name,
        ReleaseDate: release.release_date,
        ReleaseType: releaseType(release),
        TotalTracks: release.total_tracks,
        Artists: unique(release.artists.map((artist) => artist.name)).join(
          ", ",
        ),
        Label: release.label ?? "",
        Copyrights: (release.copyrights ?? [])
          .map((item) => `${item.type}: ${item.text}`)
          .join(" | "),
        RetrievedAt: importedAt,
      },
      "SpotifyAlbumId",
    );

    const trackIds = source.track_release_associations
      .filter((association) => association.album_id === release.id)
      .map((association) => association.track_id);
    for (const trackId of trackIds) {
      const recording = recordingByTrackId.get(trackId);
      if (
        !recording ||
        catalog.links.some(
          (link) =>
            link.relation === "release_recording" &&
            link.fromId === releaseEntity!.id &&
            link.toId === recording.id,
        )
      )
        continue;
      catalog.links.push({
        id: deterministicUuid(
          `spotify:link:release_recording:${releaseEntity.id}:${recording.id}`,
        ),
        fromId: releaseEntity.id,
        toId: recording.id,
        relation: "release_recording",
      });
      addedLinks++;
    }
  }

  catalog.importedAt = importedAt;
  const summary = ` Spotify (${importedAt.slice(0, 10)}): ${source.releases.length} lanzamientos y ${associationsByRecording.size} grabaciones conciliados por IDs oficiales; los datos públicos no acreditan composición, autoría ni registros legales.`;
  catalog.sourceSummary =
    `${catalog.sourceSummary.replace(/ Spotify \([^)]*\):.*$/s, "").trim()}${summary}`.slice(
      0,
      2000,
    );

  return {
    catalog: catalogSchema.parse(catalog),
    addedRecordings,
    enrichedRecordings,
    addedReleases,
    enrichedReleases,
    addedLinks,
    releaseCodeConflicts,
  };
}
