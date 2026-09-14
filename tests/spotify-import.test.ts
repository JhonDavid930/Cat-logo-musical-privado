import assert from "node:assert/strict";
import test from "node:test";
import { emptyCatalog, type Catalog, type Entity } from "../src/lib/catalog";
import {
  importSpotifyCatalog,
  type SpotifyCatalogSource,
} from "../src/lib/spotify-import";

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

const workId = "00000000-0000-4000-8000-000000000001";
const existingReleaseId = "00000000-0000-4000-8000-000000000002";
const input: Catalog = {
  ...structuredClone(emptyCatalog),
  entities: [
    entity(workId, "work", "Canción"),
    entity(existingReleaseId, "release", "Álbum", "1111111111111"),
  ],
};
const source: SpotifyCatalogSource = {
  source: "Spotify Web API",
  artist: {
    id: "artist",
    name: "David Appleton",
    url: "https://open.spotify.com/artist/artist",
  },
  market: "ES",
  releases: [
    {
      id: "album-a",
      name: "Álbum",
      album_type: "album",
      release_date: "2026-01-01",
      total_tracks: 2,
      url: "https://open.spotify.com/album/album-a",
      artists: [{ id: "artist", name: "David Appleton" }],
      upc: "2222222222222",
    },
  ],
  track_release_associations: [
    {
      track_id: "track-a",
      track_name: "Canción",
      track_artists: [{ id: "artist", name: "David Appleton" }],
      track_url: "https://open.spotify.com/track/track-a",
      duration_ms: 1000,
      disc_number: 1,
      track_number: 1,
      album_id: "album-a",
      album_name: "Álbum",
      release_date: "2026-01-01",
      isrc: "AAA111",
    },
    {
      track_id: "track-b",
      track_name: "Canción",
      track_artists: [{ id: "artist", name: "David Appleton" }],
      track_url: "https://open.spotify.com/track/track-b",
      duration_ms: 2000,
      disc_number: 1,
      track_number: 2,
      album_id: "album-a",
      album_name: "Álbum",
      release_date: "2026-01-01",
      isrc: "BBB222",
    },
  ],
};

test("Spotify añade masters por ISRC sin inventar composiciones", () => {
  const result = importSpotifyCatalog(
    input,
    source,
    "2026-09-15T12:00:00.000Z",
  );
  assert.equal(result.addedRecordings, 2);
  assert.equal(result.addedReleases, 1);
  assert.equal(result.releaseCodeConflicts, 1);
  assert.equal(
    result.catalog.entities.filter((item) => item.kind === "work").length,
    1,
  );
  assert.deepEqual(
    result.catalog.entities
      .filter((item) => item.kind === "recording")
      .map((item) => item.code)
      .sort(),
    ["AAA111", "BBB222"],
  );
  assert.equal(
    result.catalog.links.filter((link) => link.relation === "recording_work")
      .length,
    2,
  );
  assert.equal(
    result.catalog.entities.find((item) => item.id === existingReleaseId)?.code,
    "1111111111111",
  );
});

test("Spotify se puede importar de nuevo sin duplicar fichas ni relaciones", () => {
  const first = importSpotifyCatalog(input, source, "2026-09-15T12:00:00.000Z");
  const second = importSpotifyCatalog(
    first.catalog,
    source,
    "2026-09-15T13:00:00.000Z",
  );
  assert.equal(second.addedRecordings, 0);
  assert.equal(second.addedReleases, 0);
  assert.equal(second.catalog.entities.length, first.catalog.entities.length);
  assert.equal(second.catalog.links.length, first.catalog.links.length);
});
