import { z } from "zod";
import { normalizeProOrganizations } from "./pro-organizations";

export const statusLabels = {
  registered: "Registrado",
  in_progress: "En trámite",
  pending: "Pendiente",
  unchecked: "Sin comprobar",
  not_applicable: "No aplica",
} as const;
export const kindLabels = {
  work: "Composición",
  recording: "Grabación",
  video: "Vídeo",
  release: "Lanzamiento",
} as const;
export const statusSchema = z.enum([
  "registered",
  "in_progress",
  "pending",
  "unchecked",
  "not_applicable",
]);
const id = z.string().uuid();
const text = z.string().max(10000);
export const secureUrl = z
  .string()
  .max(4000)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "Usa un enlace HTTPS válido.");
const optionalUrl = z.union([secureUrl, z.literal("")]);
export const entitySchema = z.object({
  id,
  kind: z.enum(["work", "recording", "video", "release"]),
  title: z.string().trim().min(1).max(250),
  code: z.string().max(80),
  genre: z.string().max(100),
  year: z.string().max(20),
  language: z.string().max(80),
  lyrics: z.string().max(100000),
  notes: text,
  url: optionalUrl,
  sourceUrls: z.array(secureUrl).max(100),
  sourceRecords: z
    .array(
      z.record(
        z.string().max(250),
        z.union([z.string().max(100000), z.number(), z.boolean(), z.null()]),
      ),
    )
    .max(100)
    .optional(),
  publication: z.enum(["published", "unreleased", "unchecked"]),
  releaseType: z.enum(["single", "ep", "album", "unspecified"]).optional(),
  distributor: z.string().trim().max(150).optional(),
});
export const registrationSchema = z
  .object({
    id,
    entityId: id,
    agency: z.string().trim().min(1).max(100),
    organization: z.string().trim().max(100).optional(),
    status: statusSchema,
    applicable: z.enum(["yes", "no", "unknown"]),
    evidenceUrl: optionalUrl,
    verifiedAt: z.union([z.string().datetime(), z.literal("")]),
    notes: text,
    sourceValues: z.array(z.string().max(500)).max(100),
  })
  .superRefine((value, ctx) => {
    if (
      value.verifiedAt &&
      (!value.evidenceUrl ||
        value.status !== "registered" ||
        value.applicable !== "yes")
    )
      ctx.addIssue({
        code: "custom",
        message:
          "La verificación requiere registro completado, aplicabilidad confirmada y evidencia.",
        path: ["verifiedAt"],
      });
    if ((value.status === "not_applicable") !== (value.applicable === "no"))
      ctx.addIssue({
        code: "custom",
        message: "No aplica debe coincidir con la aplicabilidad.",
        path: ["applicable"],
      });
  });
export const creditSchema = z
  .object({
    id,
    entityId: id,
    name: z.string().trim().min(1).max(200),
    role: z.string().max(100),
    scope: z.enum(["authorship", "professional"]).optional(),
    share: z.number().min(0).max(100).nullable(),
    sourceUrl: optionalUrl,
  })
  .superRefine((credit, context) => {
    if (credit.scope === "professional" && credit.share !== null)
      context.addIssue({
        code: "custom",
        message:
          "Los créditos profesionales no asignan porcentajes de autoría.",
        path: ["share"],
      });
  });
export const documentSchema = z.object({
  id,
  entityId: id,
  name: z.string().trim().min(1).max(250),
  kind: z.enum(["wav", "lyrics", "certificate", "contract", "video", "other"]),
  url: optionalUrl.default(""),
  notes: text,
  file: z
    .object({
      id,
      originalName: z
        .string()
        .min(1)
        .max(250)
        .refine(
          (value) => !/[\\/\x00-\x1f\x7f]/.test(value),
          "Nombre de archivo no válido.",
        ),
      size: z
        .number()
        .int()
        .positive()
        .max(512 * 1024 * 1024),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
      mediaType: z.enum([
        "application/pdf",
        "text/plain",
        "audio/wav",
        "audio/mpeg",
        "audio/ogg",
        "audio/flac",
        "audio/mp4",
        "video/mp4",
        "video/webm",
        "application/octet-stream",
      ]),
      preview: z.enum([
        "pdf",
        "text",
        "audio",
        "video",
        "docx",
        "xlsx",
        "download",
      ]),
    })
    .optional(),
});
export const linkSchema = z.object({
  id,
  fromId: id,
  toId: id,
  relation: z.enum([
    "recording_work",
    "release_recording",
    "release_work",
    "video_recording",
  ]),
});
export const catalogSchema = z
  .object({
    version: z.literal(1),
    revision: z.number().int().nonnegative(),
    importedAt: z.string(),
    sourceSummary: z.string().max(2000),
    entities: z.array(entitySchema).max(10000),
    links: z.array(linkSchema).max(30000),
    registrations: z.array(registrationSchema).max(100000),
    credits: z.array(creditSchema).max(30000),
    documents: z.array(documentSchema).max(30000),
    proOrganizations: z
      .array(z.string().trim().min(1).max(100))
      .max(10000)
      .default([]),
  })
  .transform(normalizeProOrganizations)
  .superRefine((catalog, ctx) => {
    const entities = new Map(catalog.entities.map((e) => [e.id, e]));
    for (const list of [
      catalog.entities,
      catalog.links,
      catalog.registrations,
      catalog.credits,
      catalog.documents,
    ])
      if (new Set(list.map((e) => e.id)).size !== list.length)
        ctx.addIssue({
          code: "custom",
          message: "Identificadores duplicados.",
        });
    for (const item of [
      ...catalog.registrations,
      ...catalog.credits,
      ...catalog.documents,
    ])
      if (!entities.has(item.entityId))
        ctx.addIssue({
          code: "custom",
          message: "La ficha relacionada no existe.",
        });
    const pairs = {
      recording_work: ["recording", "work"],
      release_recording: ["release", "recording"],
      release_work: ["release", "work"],
      video_recording: ["video", "recording"],
    };
    const seen = new Set<string>();
    for (const link of catalog.links) {
      const pair = pairs[link.relation];
      if (
        entities.get(link.fromId)?.kind !== pair[0] ||
        entities.get(link.toId)?.kind !== pair[1]
      )
        ctx.addIssue({ code: "custom", message: "Relación incompatible." });
      const key = [link.fromId, link.toId, link.relation].join(":");
      if (seen.has(key))
        ctx.addIssue({ code: "custom", message: "Relación duplicada." });
      seen.add(key);
    }
    const agencies = new Set<string>();
    for (const registration of catalog.registrations) {
      const key =
        registration.entityId +
        ":" +
        registration.agency.toLowerCase() +
        ":" +
        (registration.organization || "").toLowerCase();
      if (agencies.has(key))
        ctx.addIssue({
          code: "custom",
          message: "Entidad de registro duplicada en una ficha.",
        });
      agencies.add(key);
      if (
        registration.agency === "PRO" &&
        !registration.organization &&
        catalog.registrations.some(
          (other) =>
            other.entityId === registration.entityId &&
            other.agency === "PRO" &&
            other.organization,
        )
      )
        ctx.addIssue({
          code: "custom",
          message:
            "Especifica la sociedad del PRO existente antes de añadir otra. Así no se cuenta dos veces un registro genérico.",
        });
    }
    for (const entity of catalog.entities) {
      const shares = catalog.credits
        .filter((c) => c.entityId === entity.id && c.scope !== "professional")
        .reduce((sum, c) => sum + (c.share ?? 0), 0);
      if (shares > 100.000001)
        ctx.addIssue({
          code: "custom",
          message: "Los porcentajes de autoría no pueden superar el 100 %.",
        });
    }
  });
export type Catalog = z.infer<typeof catalogSchema>;
export type Entity = z.infer<typeof entitySchema>;
export type Registration = z.infer<typeof registrationSchema>;
export type Credit = z.infer<typeof creditSchema>;
export type Document = z.infer<typeof documentSchema>;
export type Status = z.infer<typeof statusSchema>;
export const emptyCatalog: Catalog = {
  version: 1,
  revision: 0,
  importedAt: "",
  sourceSummary:
    "Catálogo vacío. Crea tu primera composición o importa tu copia de seguridad.",
  entities: [],
  links: [],
  registrations: [],
  credits: [],
  documents: [],
  proOrganizations: ["BMI", "ASCAP", "SGAE"],
};

export function removeEntity(catalog: Catalog, entityId: string): Catalog {
  if (!catalog.entities.some((entity) => entity.id === entityId))
    return catalog;
  return catalogSchema.parse({
    ...catalog,
    entities: catalog.entities.filter((entity) => entity.id !== entityId),
    links: catalog.links.filter(
      (link) => link.fromId !== entityId && link.toId !== entityId,
    ),
    registrations: catalog.registrations.filter(
      (registration) => registration.entityId !== entityId,
    ),
    credits: catalog.credits.filter((credit) => credit.entityId !== entityId),
    documents: catalog.documents.filter(
      (document) => document.entityId !== entityId,
    ),
  });
}

export function progress(registrations: Registration[]) {
  const applicable = registrations.filter(
    (r) => r.applicable === "yes" && r.status !== "not_applicable",
  );
  const declared = applicable.filter((r) => r.status === "registered").length;
  const verified = applicable.filter(
    (r) => r.status === "registered" && r.evidenceUrl && r.verifiedAt,
  ).length;
  return {
    total: applicable.length,
    declared,
    verified,
    declaredPercent: applicable.length
      ? Math.round((declared / applicable.length) * 100)
      : null,
    verifiedPercent: applicable.length
      ? Math.round((verified / applicable.length) * 100)
      : null,
    unknown: registrations.filter((r) => r.applicable === "unknown").length,
  };
}
export function relatedIds(catalog: Catalog, entityId: string) {
  const ids = new Set([entityId]);
  const entity = catalog.entities.find((e) => e.id === entityId);
  if (entity?.kind === "work") {
    for (const link of catalog.links)
      if (link.toId === entityId) ids.add(link.fromId);
    const recordings = new Set(
      catalog.links
        .filter((l) => l.relation === "recording_work" && l.toId === entityId)
        .map((l) => l.fromId),
    );
    for (const link of catalog.links)
      if (recordings.has(link.toId)) ids.add(link.fromId);
  }
  return ids;
}
export function registrationsFor(catalog: Catalog, entityId: string) {
  const ids = relatedIds(catalog, entityId);
  return catalog.registrations.filter((r) => ids.has(r.entityId));
}
export function needsAttention(r: Registration) {
  return (
    r.status !== "not_applicable" &&
    (r.status !== "registered" || !r.verifiedAt || r.applicable === "unknown")
  );
}
export function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
export function searchEntities(catalog: Catalog, query: string) {
  const q = normalizeSearch(query.trim());
  return catalog.entities.filter((entity) => {
    const ids = relatedIds(catalog, entity.id);
    const related = catalog.entities.filter((e) => ids.has(e.id));
    return normalizeSearch(
      [
        ...related.map((e) => [e.title, e.code, e.genre, e.lyrics].join(" ")),
        ...catalog.credits
          .filter((c) => ids.has(c.entityId))
          .map((c) => c.name),
      ].join(" "),
    ).includes(q);
  });
}
export function mapNotionStatus(value: unknown): Status {
  const v = String(value ?? "")
    .toLowerCase()
    .trim();
  if (["registered", "done", "__yes__"].includes(v)) return "registered";
  if (["in progress", "en progreso"].includes(v)) return "in_progress";
  if (["not registered", "not started"].includes(v)) return "pending";
  return "unchecked";
}
