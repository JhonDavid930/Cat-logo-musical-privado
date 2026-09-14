import { relatedIds, type Catalog } from "./catalog";

export function genreSources(catalog: Catalog, entityId: string) {
  const ids = relatedIds(catalog, entityId);
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
