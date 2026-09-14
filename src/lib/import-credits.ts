import { randomUUID } from "node:crypto";
import type { Catalog } from "./catalog";
export type SourcePerson = { name: string; sourceUrl: string };

export function enrichSourceCredits(input: Catalog, people: SourcePerson[]) {
  const catalog = structuredClone(input);
  let added = 0;
  for (const entity of catalog.entities) {
    for (const row of entity.sourceRecords || []) {
      const sources: [string, string][] =
        entity.kind === "recording"
          ? [
              ["Producer", "Productor"],
              ["Writer(s)", "Autor (según fuente)"],
            ]
          : entity.kind === "release"
            ? [["Primary / Main Artist(s)", "Artista principal"]]
            : [];
      for (const [property, role] of sources) {
        let urls: unknown;
        try {
          urls = JSON.parse(String(row[property] || "[]"));
        } catch {
          continue;
        }
        if (!Array.isArray(urls)) continue;
        for (const url of urls) {
          const person = people.find((person) => person.sourceUrl === url);
          if (
            !person ||
            catalog.credits.some(
              (credit) =>
                credit.entityId === entity.id &&
                credit.role === role &&
                credit.sourceUrl === url,
            )
          )
            continue;
          catalog.credits.push({
            id: randomUUID(),
            entityId: entity.id,
            name: person.name,
            role,
            scope: "professional",
            share: null,
            sourceUrl: person.sourceUrl,
          });
          added++;
        }
      }
      if (entity.kind === "video" && typeof row.Credits === "string") {
        const roles: Record<string, string> = {
          Director: "Director",
          "Director de Fotografía": "Dirección de fotografía",
          "Direccion de fotografia": "Dirección de fotografía",
          Actriz: "Actriz",
          Actor: "Actor",
          Estilista: "Estilista",
          "Productor musical": "Productor musical",
          Productor: "Productor",
          Gaffer: "Gaffer",
          Eléctrico: "Eléctrico",
        };
        for (const line of row.Credits.split(/<br\s*\/?\s*>|\n/)) {
          const match = /^([^:]+):\s*([^<>\[\]]{1,200})$/.exec(line.trim());
          if (!match || !roles[match[1]] || !match[2].trim()) continue;
          const name = match[2].trim(),
            role = roles[match[1]],
            sourceUrl = String(row.url || entity.sourceUrls[0] || "");
          if (
            catalog.credits.some(
              (credit) =>
                credit.entityId === entity.id &&
                credit.role === role &&
                credit.name === name,
            )
          )
            continue;
          catalog.credits.push({
            id: randomUUID(),
            entityId: entity.id,
            name,
            role,
            scope: "professional",
            share: null,
            sourceUrl,
          });
          added++;
        }
      }
    }
  }
  return { catalog, added };
}
