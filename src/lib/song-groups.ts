import {
  relatedIds,
  type Catalog,
  type Entity,
  type Registration,
} from "./catalog";

export type SongGroup = {
  id: string;
  title: string;
  primary: Entity;
  entities: Entity[];
  isrcs: string[];
};

const primaryKindOrder: Record<Entity["kind"], number> = {
  work: 0,
  recording: 1,
  video: 2,
  release: 3,
};

export function normalizeSongTitle(title: string) {
  return title
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("es")
    .replace(/[’'`´]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function entityRichness(entity: Entity) {
  return [
    entity.code,
    entity.genre,
    entity.year,
    entity.language,
    entity.lyrics,
    entity.notes,
    entity.url,
  ].filter(Boolean).length;
}

function choosePrimary(entities: Entity[]) {
  return [...entities].sort(
    (left, right) =>
      primaryKindOrder[left.kind] - primaryKindOrder[right.kind] ||
      Number(Boolean(right.code)) - Number(Boolean(left.code)) ||
      entityRichness(right) - entityRichness(left) ||
      left.title.localeCompare(right.title, "es"),
  )[0];
}

function titlePresentationScore(entity: Entity) {
  const letters = entity.title.replace(/[^\p{L}]/gu, "");
  const hasLowercase = letters !== letters.toLocaleUpperCase("es");
  const hasDiacritics = /[^\u0000-\u007f]/.test(entity.title);
  const hasIntentionalPunctuation = /[’'()\-]/.test(entity.title);
  return (
    Number(hasLowercase) * 100 +
    Number(hasDiacritics) * 10 +
    Number(hasIntentionalPunctuation) * 2 +
    entityRichness(entity)
  );
}

function chooseDisplayTitle(entities: Entity[]) {
  return [...entities].sort(
    (left, right) =>
      titlePresentationScore(right) - titlePresentationScore(left) ||
      left.title.localeCompare(right.title, "es"),
  )[0].title;
}

export function buildSongGroups(catalog: Catalog): SongGroup[] {
  const grouped = new Map<string, Entity[]>();
  for (const entity of catalog.entities.filter(
    (candidate) => candidate.kind !== "release",
  )) {
    const key = normalizeSongTitle(entity.title) || entity.id;
    grouped.set(key, [...(grouped.get(key) ?? []), entity]);
  }
  for (const release of catalog.entities.filter(
    (candidate) => candidate.kind === "release",
  )) {
    const key = normalizeSongTitle(release.title);
    if (grouped.has(key)) grouped.get(key)!.push(release);
  }
  return [...grouped.entries()]
    .map(([id, entities]) => {
      const primary = choosePrimary(entities);
      return {
        id,
        title: chooseDisplayTitle(entities),
        primary,
        entities,
        isrcs: [
          ...new Set(
            entities
              .filter((entity) => entity.kind === "recording" && entity.code)
              .map((entity) => entity.code),
          ),
        ],
      };
    })
    .sort((left, right) => left.title.localeCompare(right.title, "es"));
}

export function songGroupForEntity(catalog: Catalog, entityId: string) {
  const entity = catalog.entities.find((item) => item.id === entityId);
  if (!entity) return undefined;
  const key = normalizeSongTitle(entity.title);
  return buildSongGroups(catalog).find((group) => group.id === key);
}

export function songContextIds(catalog: Catalog, entityId: string) {
  const ids = new Set<string>();
  const group = songGroupForEntity(catalog, entityId);
  for (const member of group?.entities ?? []) {
    for (const relatedId of relatedIds(catalog, member.id)) ids.add(relatedId);
    ids.add(member.id);
  }
  if (!group) ids.add(entityId);
  return ids;
}

export function registrationsForSongGroup(
  catalog: Catalog,
  group: SongGroup,
): Registration[] {
  const ids = new Set<string>();
  for (const member of group.entities)
    for (const id of relatedIds(catalog, member.id)) ids.add(id);
  return catalog.registrations.filter((registration) =>
    ids.has(registration.entityId),
  );
}
