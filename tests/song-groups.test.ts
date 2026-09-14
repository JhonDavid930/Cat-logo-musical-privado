import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { emptyCatalog, type Catalog, type Entity } from "../src/lib/catalog";
import {
  buildSongGroups,
  normalizeSongTitle,
  registrationsForSongGroup,
  songContextIds,
} from "../src/lib/song-groups";

function entity(title: string, kind: Entity["kind"], code = ""): Entity {
  return {
    id: randomUUID(),
    title,
    kind,
    code,
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

function catalog(entities: Entity[]): Catalog {
  return { ...structuredClone(emptyCatalog), entities };
}

test("unifica mayúsculas, acentos, apóstrofes y espacios del mismo título", () => {
  assert.equal(normalizeSongTitle("  BILINGÜE  "), "bilingue");
  assert.equal(normalizeSongTitle("Bilingue"), "bilingue");
  assert.equal(normalizeSongTitle("Pa’ Ti"), normalizeSongTitle("PA-TI"));
});

test("mantiene una versión nombrada como grupo distinto", () => {
  const groups = buildSongGroups(
    catalog([
      entity("Bilingüe", "work"),
      entity("BILINGUE", "recording", "QZAAA2600001"),
      entity("Bilingüe Remastered", "recording", "QZAAA2600002"),
    ]),
  );
  assert.equal(groups.length, 2);
  assert.equal(
    groups.find((group) => group.id === "bilingue")?.entities.length,
    2,
  );
});

test("muestra una canción con todos sus ISRC y prefiere la composición", () => {
  const work = entity("ESTARE", "work", "T-123.456.789-0");
  const first = entity("ESTARÉ", "recording", "QZAAA2600001");
  const second = entity("Estare", "recording", "QZAAA2600002");
  const release = entity("Estaré", "release", "123456789012");
  const groups = buildSongGroups(catalog([first, release, work, second]));
  assert.equal(groups.length, 1);
  assert.equal(groups[0].primary.id, work.id);
  assert.equal(groups[0].title, "Estaré");
  assert.deepEqual(groups[0].isrcs, ["QZAAA2600001", "QZAAA2600002"]);
  assert.equal(groups[0].entities.length, 4);
});

test("un álbum no se convierte en canción ni conecta pistas diferentes", () => {
  const first = entity("Tema uno", "recording", "QZAAA2600001");
  const second = entity("Tema dos", "recording", "QZAAA2600002");
  const album = entity("Mi álbum", "release", "123456789012");
  const data = catalog([first, second, album]);
  data.links = [
    {
      id: randomUUID(),
      fromId: album.id,
      toId: first.id,
      relation: "release_recording",
    },
    {
      id: randomUUID(),
      fromId: album.id,
      toId: second.id,
      relation: "release_recording",
    },
  ];
  const groups = buildSongGroups(data);
  assert.equal(groups.length, 2);
  assert.equal(
    groups.some((group) => group.title === "Mi álbum"),
    false,
  );
});

test("la ficha unificada reúne relaciones y registros de títulos equivalentes", () => {
  const work = entity("Estaré", "work");
  const recording = entity("ESTARE", "recording", "QZAAA2600001");
  const data = catalog([work, recording]);
  data.registrations = [
    {
      id: randomUUID(),
      entityId: work.id,
      agency: "BMI",
      organization: "",
      status: "registered",
      applicable: "yes",
      evidenceUrl: "",
      verifiedAt: "",
      notes: "",
      sourceValues: [],
    },
    {
      id: randomUUID(),
      entityId: recording.id,
      agency: "SoundExchange",
      organization: "",
      status: "registered",
      applicable: "yes",
      evidenceUrl: "",
      verifiedAt: "",
      notes: "",
      sourceValues: [],
    },
  ];
  const group = buildSongGroups(data)[0];
  assert.equal(registrationsForSongGroup(data, group).length, 2);
  assert.deepEqual(
    [...songContextIds(data, work.id)].sort(),
    [work.id, recording.id].sort(),
  );
});
