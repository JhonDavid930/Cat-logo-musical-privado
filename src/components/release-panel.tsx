"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { type Catalog, type Entity } from "@/lib/catalog";
import {
  releaseIds,
  upcIssue,
  releaseTypeLabels,
  releaseTypeFromSource,
} from "@/lib/release-codes";
import type { SaveCatalog } from "./catalog-app";

export default function ReleasePanel({
  entity,
  catalog,
  save,
  busy,
  open,
}: {
  entity: Entity;
  catalog: Catalog;
  save: SaveCatalog;
  busy: boolean;
  open: (id: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const ids = releaseIds(catalog, entity);
  const releases = catalog.entities.filter((item) => ids.has(item.id));
  const available = catalog.entities.filter(
    (item) => item.kind === "release" && !ids.has(item.id),
  );
  const canLink = entity.kind === "work" || entity.kind === "recording";
  const link = (releaseId: string) => ({
    id: crypto.randomUUID(),
    fromId: releaseId,
    toId: entity.id,
    relation:
      entity.kind === "work"
        ? ("release_work" as const)
        : ("release_recording" as const),
  });
  return (
    <section className="panel release-panel">
      <p className="eyebrow">IDENTIFICA CADA LANZAMIENTO</p>
      <h2>Lanzamientos y UPC</h2>
      <p className="muted">
        Una canción puede aparecer en varios sencillos o álbumes, cada uno con
        su propio UPC o EAN. Puedes dejarlos vacíos mientras no tengas el
        código.
      </p>
      {!releases.length && (
        <p className="note">
          Esta ficha todavía no tiene un lanzamiento asociado.
        </p>
      )}
      {releases.map((release) => (
        <ReleaseEditor
          key={release.id + catalog.revision}
          release={release}
          catalog={catalog}
          busy={busy}
          save={async (code, releaseType) =>
            save({
              ...catalog,
              entities: catalog.entities.map((item) =>
                item.id === release.id ? { ...item, code, releaseType } : item,
              ),
            })
          }
          open={release.id !== entity.id ? () => open(release.id) : undefined}
        />
      ))}
      {canLink && (
        <>
          <button className="primary" onClick={() => setCreating(!creating)}>
            <Plus size={16} />
            {creating ? "Cerrar nuevo lanzamiento" : "Añadir lanzamiento y UPC"}
          </button>
          {creating && (
            <form
              className="form-grid release-create"
              onSubmit={async (event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                const release: Entity = {
                  id: crypto.randomUUID(),
                  kind: "release",
                  title: String(data.get("releaseTitle")),
                  code: String(data.get("upc")),
                  releaseType: String(
                    data.get("releaseType"),
                  ) as Entity["releaseType"],
                  genre: "",
                  year: "",
                  language: "",
                  lyrics: "",
                  notes: "",
                  url: "",
                  sourceUrls: [],
                  publication: "unchecked",
                };
                if (
                  await save({
                    ...catalog,
                    entities: [...catalog.entities, release],
                    links: [...catalog.links, link(release.id)],
                  })
                )
                  setCreating(false);
              }}
            >
              <label>
                Nombre del lanzamiento
                <input
                  name="releaseTitle"
                  required
                  maxLength={250}
                  placeholder="Nombre del sencillo o álbum"
                  defaultValue={entity.title}
                />
              </label>
              <ReleaseTypeField />
              <UpcField />
              <button disabled={busy}>Crear lanzamiento asociado</button>
            </form>
          )}
          {available.length > 0 && (
            <details className="release-associate">
              <summary>Asociar un lanzamiento que ya existe</summary>
              <form
                className="inline-form"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  const releaseId = String(data.get("releaseId"));
                  if (available.some((item) => item.id === releaseId))
                    await save({
                      ...catalog,
                      links: [...catalog.links, link(releaseId)],
                    });
                }}
              >
                <label>
                  Lanzamiento existente
                  <select name="releaseId">
                    {available.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                        {item.code ? ` · ${item.code}` : " · UPC pendiente"}
                      </option>
                    ))}
                  </select>
                </label>
                <button disabled={busy}>Asociar lanzamiento</button>
              </form>
            </details>
          )}
        </>
      )}
      <p className="muted">
        La comprobación revisa el formato y el dígito de control; no confirma la
        titularidad ni que el código esté asignado.
      </p>
    </section>
  );
}

function UpcField({ value = "" }: { value?: string }) {
  const [code, setCode] = useState(value);
  const issue = upcIssue(code);
  return (
    <div>
      <label>
        UPC / EAN del lanzamiento
        <input
          name="upc"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          maxLength={80}
          placeholder="12 o 13 dígitos · opcional"
        />
      </label>
      {issue && (
        <span className="upc-warning">
          {value === code ? "Valor conservado; por revisar. " : ""}
          {issue}
        </span>
      )}
      {code && !issue && (
        <small>
          Formato {code.length === 12 ? "UPC-A" : "EAN-13"} y dígito de control
          correctos.
        </small>
      )}
    </div>
  );
}

function ReleaseEditor({
  release,
  catalog,
  busy,
  save,
  open,
}: {
  release: Entity;
  catalog: Catalog;
  busy: boolean;
  save: (code: string, releaseType: Entity["releaseType"]) => Promise<boolean>;
  open?: () => void;
}) {
  const duplicates = release.code
    ? catalog.entities.filter(
        (item) =>
          item.kind === "release" &&
          item.id !== release.id &&
          item.code === release.code,
      )
    : [];
  return (
    <article className="release-entry">
      <h3>{release.title}</h3>
      <p>{releaseTypeLabels[releaseTypeFromSource(release)]}</p>
      <form
        className="inline-form"
        onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          await save(
            String(data.get("upc")),
            String(data.get("releaseType")) as Entity["releaseType"],
          );
        }}
      >
        <ReleaseTypeField value={releaseTypeFromSource(release)} />
        <UpcField value={release.code} />
        <button disabled={busy}>Guardar UPC / EAN</button>
        {open && (
          <button type="button" className="subtle" onClick={open}>
            Ver lanzamiento
          </button>
        )}
      </form>
      {duplicates.length > 0 && (
        <p className="note">
          Este código también figura en{" "}
          {duplicates.map((item) => item.title).join(", ")}. Revisa si son
          fichas del mismo lanzamiento; no se han fusionado.
        </p>
      )}
      {release.sourceRecords?.some((row) => row.UPC) && (
        <details>
          <summary>Ver UPC original de Notion</summary>
          {release.sourceRecords
            .filter((row) => row.UPC)
            .map((row, index) => (
              <p key={index} className="preserve-text">
                {String(row.UPC)}
              </p>
            ))}
        </details>
      )}
    </article>
  );
}

function ReleaseTypeField({
  value = "unspecified",
}: {
  value?: Entity["releaseType"];
}) {
  return (
    <label>
      Tipo de lanzamiento
      <select name="releaseType" defaultValue={value}>
        {Object.entries(releaseTypeLabels).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
