import type { Catalog, Entity } from "./catalog";
export const releaseTypeLabels = {
  single: "Single",
  ep: "EP",
  album: "Álbum",
  unspecified: "Tipo sin especificar",
} as const;
export function releaseTypeFromSource(
  entity: Entity,
): keyof typeof releaseTypeLabels {
  if (entity.releaseType) return entity.releaseType;
  const types = [
    ...new Set(
      (entity.sourceRecords || []).map((row) => row.Type).filter(Boolean),
    ),
  ];
  return types.length === 1
    ? ({ Single: "single", EP: "ep", Album: "album" } as const)[
        String(types[0]) as "Single" | "EP" | "Album"
      ] || "unspecified"
    : "unspecified";
}

export function upcIssue(code: string): string | null {
  if (!code) return null;
  if (!/^(\d{12}|\d{13})$/.test(code))
    return "Usa 12 dígitos para UPC-A o 13 para EAN-13, sin espacios ni guiones. Puedes dejarlo vacío si aún no lo tienes.";
  const body = code.slice(0, -1);
  const sum = [...body]
    .reverse()
    .reduce(
      (sum, digit, index) => sum + Number(digit) * (index % 2 === 0 ? 3 : 1),
      0,
    );
  if ((10 - (sum % 10)) % 10 !== Number(code.at(-1)))
    return "El dígito de control no coincide. Revisa el código completo en tu distribuidora; no lo corregimos ni generamos automáticamente.";
  return null;
}

export function releaseIds(catalog: Catalog, entity: Entity) {
  const targets = new Set([entity.id]);
  if (entity.kind === "work")
    for (const link of catalog.links)
      if (link.relation === "recording_work" && link.toId === entity.id)
        targets.add(link.fromId);
  const ids = new Set(entity.kind === "release" ? [entity.id] : []);
  for (const link of catalog.links)
    if (
      (link.relation === "release_work" ||
        link.relation === "release_recording") &&
      targets.has(link.toId)
    )
      ids.add(link.fromId);
  return ids;
}

export function changedReleaseCodeIssue(next: Catalog, previous: Catalog) {
  for (const entity of next.entities) {
    if (
      entity.kind !== "release" ||
      !entity.code ||
      previous.entities.some(
        (old) =>
          old.id === entity.id &&
          old.kind === "release" &&
          old.code === entity.code,
      )
    )
      continue;
    const sourceMatch = entity.sourceRecords?.some(
      (row) =>
        String(row.UPC || "")
          .replace(/\*\*/g, "")
          .trim() === entity.code,
    );
    if (sourceMatch) continue;
    const issue = upcIssue(entity.code);
    if (issue) return `${entity.title}: ${issue}`;
  }
  return null;
}
