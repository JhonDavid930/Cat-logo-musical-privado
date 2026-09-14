import { type Catalog } from "./catalog";
import { songContextIds } from "./song-groups";

export function genreSources(catalog: Catalog, entityId: string) {
  const ids = songContextIds(catalog, entityId);
  return catalog.entities.filter(
    (entity) =>
      ids.has(entity.id) &&
      entity.genre.trim() &&
      (entity.id === entityId || entity.kind === "recording"),
  );
}

export function genreSummary(catalog: Catalog, entityId: string) {
  return [
    ...new Set(genreSources(catalog, entityId).map((entity) => entity.genre)),
  ].join(" · ");
}
