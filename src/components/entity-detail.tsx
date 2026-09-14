"use client";
import { useState } from "react";
import {
  ArrowRight,
  ExternalLink,
  Link2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import {
  kindLabels,
  progress,
  removeEntity,
  registrationsFor,
  relatedIds,
  statusLabels,
  type Catalog,
  type Credit,
  type Entity,
  type Registration,
  type Status,
} from "@/lib/catalog";
import type { SaveCatalog } from "./catalog-app";
import ProgressMeter from "./progress-meter";
import ProfessionalCredits, { CreditSummary } from "./professional-credits";
import FilesPanel from "./files-panel";
import GenreField from "./genre-field";
import ReleasePanel from "./release-panel";
import NewRegistrationForm from "./new-registration-form";
import OrganizationField from "./organization-field";
import { registrationLabel } from "@/lib/registration-label";
import { genreSources, genreSummary } from "@/lib/genres";

export default function EntityDetail({
  entity,
  catalog,
  save,
  busy,
  open,
  onCatalogChange,
}: {
  entity: Entity;
  catalog: Catalog;
  save: SaveCatalog;
  busy: boolean;
  open: (id: string | null) => void;
  onCatalogChange: (catalog: Catalog) => void;
}) {
  const [tab, setTab] = useState("summary");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const ids = relatedIds(catalog, entity.id),
    related = catalog.entities.filter(
      (e) => e.id !== entity.id && ids.has(e.id),
    ),
    registrations = registrationsFor(catalog, entity.id),
    p = progress(registrations),
    documents = catalog.documents.filter((d) => ids.has(d.entityId)),
    credits = catalog.credits.filter(
      (c) => c.entityId === entity.id && c.scope !== "professional",
    );
  const patchEntity = async (patch: Partial<Entity>) =>
    save({
      ...catalog,
      entities: catalog.entities.map((e) =>
        e.id === entity.id ? { ...e, ...patch } : e,
      ),
    });
  return (
    <article className="detail">
      <header className="detail-header">
        <p className="eyebrow">{kindLabels[entity.kind]} · ARCHIVO PERSONAL</p>
        <h1>{entity.title}</h1>
        <div className="detail-meta">
          <span
            title={genreSources(catalog, entity.id)
              .map((item) => `${item.title}: ${item.genre}`)
              .join("; ")}
          >
            {genreSummary(catalog, entity.id) || "Género sin indicar"}
          </span>
          <span>{entity.year || "Año sin indicar"}</span>
          <span>
            {entity.publication === "published"
              ? "Publicada"
              : entity.publication === "unreleased"
                ? "Inédita"
                : "Publicación sin comprobar"}
          </span>
        </div>
        {entity.url && (
          <a
            className="button"
            href={entity.url}
            target="_blank"
            rel="noreferrer"
          >
            Abrir enlace musical
            <ExternalLink size={16} />
          </a>
        )}
      </header>
      <details className="genre-provenance">
        <summary>Ver procedencia de los géneros</summary>
        {genreSources(catalog, entity.id).map((item) => (
          <p key={item.id}>
            {kindLabels[item.kind]} · {item.title}:{" "}
            <strong>{item.genre}</strong>
          </p>
        ))}
      </details>
      <nav className="detail-tabs" aria-label="Secciones de la ficha">
        {[
          ["summary", "La canción"],
          ["registrations", "Registros"],
          ["files", "Archivos"],
          ["credits", "Créditos"],
          ["edit", "Editar ficha"],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-current={tab === key ? "page" : undefined}
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}
          >
            {label}
            {key === "files" && <small>{documents.length}</small>}
          </button>
        ))}
      </nav>
      {tab === "summary" && (
        <>
          <section className="detail-grid">
            <article className="panel">
              <p className="eyebrow">
                IDENTIDAD DE LA {kindLabels[entity.kind].toUpperCase()}
              </p>
              <h2>Los detalles que la hacen tuya.</h2>
              <dl>
                <div>
                  <dt>
                    {entity.kind === "work"
                      ? "ISWC · Código de composición"
                      : entity.kind === "release"
                        ? "UPC · Código del lanzamiento"
                        : "ISRC · Código de grabación o vídeo"}
                  </dt>
                  <dd className="code">{entity.code || "Sin indicar"}</dd>
                </div>
                <div>
                  <dt>Idioma de la letra</dt>
                  <dd>{entity.language || "Sin indicar"}</dd>
                </div>
              </dl>
              <p className="muted">
                Tener un código no confirma el registro en ninguna entidad.
              </p>
              {entity.notes && (
                <div className="note">
                  <h3>Notas de la ficha</h3>
                  <p>{entity.notes}</p>
                </div>
              )}
            </article>
            <article className="panel progress-panel">
              <p className="eyebrow">CUIDA TUS DERECHOS</p>
              <h2>
                {p.declaredPercent === null
                  ? "Por comprobar"
                  : `${p.declaredPercent}% declarado`}
              </h2>
              <ProgressMeter
                value={p.declaredPercent}
                label={`${entity.title}: registros declarados`}
              />
              <div className="meter-caption">
                <span>Evidencia revisada</span>
                <span>
                  {p.verifiedPercent === null ? "—" : `${p.verifiedPercent}%`}
                </span>
              </div>
              <ProgressMeter
                value={p.verifiedPercent}
                label={`${entity.title}: evidencia revisada`}
                tone="verified"
              />
              <p>
                {p.declared} de {p.total} registros aplicables declarados.
                <br />
                {p.verified} con evidencia revisada.
              </p>
              {p.unknown > 0 && (
                <p className="muted">
                  Falta confirmar si aplican {p.unknown} registros.
                </p>
              )}
              <button onClick={() => setTab("registrations")}>
                Revisar mis registros
                <ArrowRight size={16} />
              </button>
            </article>
          </section>
          {entity.kind === "work" && (
            <section className="panel">
              <p className="eyebrow">AUTORÍA</p>
              <h2>Quién la escribió.</h2>
              {credits.length ? (
                credits.map((c) => (
                  <div key={c.id} className="credit-row">
                    <strong>{c.name}</strong>
                    <span>{c.role}</span>
                    <span>
                      {c.share === null
                        ? "Porcentaje sin confirmar"
                        : `${c.share}%`}
                    </span>
                  </div>
                ))
              ) : (
                <p>No hay autores añadidos.</p>
              )}
              <p className="muted">
                {credits.some((c) => c.share === null)
                  ? "El reparto está incompleto. No se presume un 100 % por figurar un solo autor."
                  : `Reparto indicado: ${credits.reduce((s, c) => s + (c.share ?? 0), 0)} %. Debe sumar 100 % cuando esté completo.`}
              </p>
              <button className="subtle" onClick={() => setTab("edit")}>
                Editar autores y porcentajes
                <ArrowRight size={16} />
              </button>
            </section>
          )}
          <CreditSummary catalog={catalog} entityId={entity.id} />
          {(entity.kind === "work" ||
            entity.kind === "recording" ||
            entity.kind === "release") && (
            <ReleasePanel
              entity={entity}
              catalog={catalog}
              save={save}
              busy={busy}
              open={open}
            />
          )}
          <section>
            <div className="section-heading">
              <div>
                <p className="eyebrow">UNA CANCIÓN, DISTINTAS FORMAS</p>
                <h2>Versiones y lanzamientos.</h2>
              </div>
            </div>
            {related.length ? (
              <div className="related-grid">
                {related.map((e) => (
                  <button
                    key={e.id}
                    className="related-card"
                    onClick={() => open(e.id)}
                  >
                    <small>{kindLabels[e.kind]}</small>
                    <strong>{e.title}</strong>
                    <span>
                      {e.code || "Código sin indicar"}
                      <ArrowRight size={16} />
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted">
                Todavía no hay versiones vinculadas a esta ficha.
              </p>
            )}
            {entity.kind !== "work" && (
              <div className="related-grid">
                {catalog.links
                  .filter((l) => l.fromId === entity.id)
                  .map((l) => {
                    const e = catalog.entities.find((e) => e.id === l.toId)!;
                    return (
                      <button
                        key={l.id}
                        className="related-card"
                        onClick={() => open(e.id)}
                      >
                        <small>{kindLabels[e.kind]}</small>
                        <strong>{e.title}</strong>
                        <ArrowRight size={16} />
                      </button>
                    );
                  })}
              </div>
            )}
            <details className="panel">
              <summary>
                <Link2 size={16} />
                Vincular con otra ficha
              </summary>
              <RelationForm
                entity={entity}
                catalog={catalog}
                save={save}
                busy={busy}
              />
            </details>
          </section>
          {entity.kind === "work" && (
            <section className="panel">
              <p className="eyebrow">PALABRAS QUE PERMANECEN</p>
              <h2>La letra.</h2>
              {entity.lyrics ? (
                <p className="lyrics">{entity.lyrics}</p>
              ) : (
                <p className="muted">
                  Todavía no has añadido el texto de esta letra.
                </p>
              )}
              <button className="subtle" onClick={() => setTab("edit")}>
                {entity.lyrics ? "Editar letra" : "Añadir letra"}
                <Plus size={16} />
              </button>
            </section>
          )}
          <details className="source-note">
            <summary>
              Ver fuentes originales ({entity.sourceUrls.length})
            </summary>
            {entity.sourceUrls.length ? (
              entity.sourceUrls.map((url, index) => (
                <a
                  key={url}
                  className="source-link"
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ficha de Notion {index + 1}
                  <ExternalLink size={14} />
                </a>
              ))
            ) : (
              <p>Ficha creada en este archivo.</p>
            )}
          </details>
        </>
      )}
      {tab === "registrations" && (
        <section>
          <h2>Qué está hecho. Qué falta.</h2>
          <p className="muted">
            Confirma primero si el registro aplica. Marca la evidencia como
            revisada solo después de abrir y comprobar el justificante.
          </p>
          {registrations.map((r) => (
            <RegistrationEditor
              key={r.id + ":" + catalog.revision}
              registration={r}
              organizations={catalog.proOrganizations}
              title={
                catalog.entities.find((e) => e.id === r.entityId)?.title ?? ""
              }
              busy={busy}
              save={(next) =>
                save({
                  ...catalog,
                  registrations: catalog.registrations.map((item) =>
                    item.id === next.id ? next : item,
                  ),
                })
              }
            />
          ))}
          <details className="panel">
            <summary>
              <Plus size={16} />
              Añadir otra entidad de registro
            </summary>
            <NewRegistrationForm
              catalog={catalog}
              entityId={entity.id}
              save={save}
              busy={busy}
            />
          </details>
        </section>
      )}
      {tab === "files" && (
        <FilesPanel
          entityId={entity.id}
          catalog={catalog}
          save={save}
          busy={busy}
          onCatalogChange={onCatalogChange}
        />
      )}
      {tab === "credits" && (
        <>
          <CreditSummary catalog={catalog} entityId={entity.id} />
          <ProfessionalCredits
            catalog={catalog}
            entityId={entity.id}
            save={save}
            busy={busy}
          />
          <p className="note">
            Los autores y sus porcentajes se editan por separado en Editar
            ficha, dentro de la composición.
          </p>
        </>
      )}
      {tab === "edit" && (
        <>
          <form
            key={catalog.revision}
            className="panel form-grid"
            onSubmit={async (event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              await patchEntity({
                title: String(data.get("title")),
                code: String(data.get("code")),
                genre: String(data.get("genre")),
                year: String(data.get("year")),
                language: String(data.get("language")),
                url: String(data.get("url")),
                lyrics: String(data.get("lyrics") ?? entity.lyrics),
                notes: String(data.get("notes")),
                publication: String(
                  data.get("publication"),
                ) as Entity["publication"],
              });
            }}
          >
            <h2 className="full">La información de tu ficha.</h2>
            <label className="full">
              Título
              <input
                name="title"
                defaultValue={entity.title}
                required
                maxLength={250}
              />
            </label>
            <label>
              {entity.kind === "work"
                ? "ISWC · Código de composición"
                : entity.kind === "release"
                  ? "UPC · Código de lanzamiento"
                  : "ISRC · Código de grabación o vídeo"}
              <input name="code" defaultValue={entity.code} maxLength={80} />
            </label>
            <GenreField
              value={entity.genre}
              existing={catalog.entities.map((item) => item.genre)}
            />
            <label>
              Año o fecha
              <input name="year" defaultValue={entity.year} maxLength={20} />
            </label>
            <label>
              Idioma de la letra
              <input
                name="language"
                defaultValue={entity.language}
                maxLength={80}
              />
            </label>
            <label>
              Publicación
              <select name="publication" defaultValue={entity.publication}>
                <option value="unchecked">Sin comprobar</option>
                <option value="unreleased">Inédita</option>
                <option value="published">Publicada</option>
              </select>
            </label>
            <label>
              Enlace musical
              <input
                name="url"
                type="url"
                defaultValue={entity.url}
                maxLength={4000}
              />
            </label>
            {entity.kind === "work" && (
              <label className="full">
                Texto de la letra
                <textarea
                  name="lyrics"
                  rows={10}
                  defaultValue={entity.lyrics}
                  maxLength={100000}
                />
              </label>
            )}
            <label className="full">
              Notas
              <textarea
                name="notes"
                rows={3}
                defaultValue={entity.notes}
                maxLength={10000}
              />
            </label>
            <button className="primary" disabled={busy}>
              <Save size={16} />
              {busy ? "Guardando…" : "Guardar cambios"}
            </button>
          </form>
          <ProfessionalCredits
            catalog={catalog}
            entityId={entity.id}
            save={save}
            busy={busy}
          />
          {entity.kind === "work" && (
            <section className="panel">
              <h2>Autores y porcentajes</h2>
              {credits.map((credit) => (
                <CreditEditor
                  key={credit.id + catalog.revision}
                  credit={credit}
                  busy={busy}
                  save={(next) =>
                    save({
                      ...catalog,
                      credits: catalog.credits.map((c) =>
                        c.id === next.id ? next : c,
                      ),
                    })
                  }
                />
              ))}
              <form
                className="inline-form"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const data = new FormData(form);
                  const share = String(data.get("share"));
                  if (
                    await save({
                      ...catalog,
                      credits: [
                        ...catalog.credits,
                        {
                          id: crypto.randomUUID(),
                          entityId: entity.id,
                          name: String(data.get("name")),
                          role: "Autor",
                          scope: "authorship",
                          share: share === "" ? null : Number(share),
                          sourceUrl: "",
                        },
                      ],
                    })
                  )
                    form.reset();
                }}
              >
                <label>
                  Nuevo autor
                  <input name="name" required maxLength={200} />
                </label>
                <label>
                  Porcentaje (si lo conoces)
                  <input
                    name="share"
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                  />
                </label>
                <button disabled={busy}>
                  Añadir autor
                  <Plus size={16} />
                </button>
              </form>
            </section>
          )}
          <section className="panel danger-zone" aria-labelledby="delete-title">
            <p className="eyebrow">ELIMINACIÓN DEFINITIVA</p>
            <h2 id="delete-title">Eliminar esta ficha</h2>
            <p>
              Se eliminará esta ficha de tipo{" "}
              {kindLabels[entity.kind].toLowerCase()}, junto con sus registros,
              créditos y archivos directos. Las composiciones, grabaciones y
              lanzamientos relacionados se conservarán como fichas
              independientes.
            </p>
            <p className="muted">
              Esta acción no se puede deshacer desde la ficha. Descarga una
              copia de seguridad si necesitas conservar una versión anterior.
            </p>
            <label>
              Escribe el título exacto para confirmar
              <input
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                autoComplete="off"
                placeholder={entity.title}
                aria-describedby="delete-confirmation-help"
              />
            </label>
            <small id="delete-confirmation-help">
              Debes escribir: {entity.title}
            </small>
            <button
              type="button"
              className="danger"
              disabled={busy || deleteConfirmation !== entity.title}
              onClick={async () => {
                if (await save(removeEntity(catalog, entity.id))) open(null);
              }}
            >
              <Trash2 size={16} />
              {busy ? "Eliminando…" : "Eliminar definitivamente"}
            </button>
          </section>
        </>
      )}
    </article>
  );
}
function CreditEditor({
  credit,
  busy,
  save,
}: {
  credit: Credit;
  busy: boolean;
  save: (credit: Credit) => Promise<boolean>;
}) {
  return (
    <form
      className="inline-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const value = String(data.get("share"));
        await save({
          ...credit,
          name: String(data.get("name")),
          share: value === "" ? null : Number(value),
        });
      }}
    >
      <label>
        Autor
        <input
          name="name"
          defaultValue={credit.name}
          required
          maxLength={200}
        />
      </label>
      <label>
        Porcentaje
        <input
          name="share"
          type="number"
          min={0}
          max={100}
          step="0.01"
          defaultValue={credit.share ?? ""}
          placeholder="Sin confirmar"
        />
      </label>
      <button disabled={busy}>Guardar autor</button>
    </form>
  );
}
function RegistrationEditor({
  registration: r,
  organizations,
  title,
  save,
  busy,
}: {
  registration: Registration;
  organizations: string[];
  title: string;
  save: (r: Registration) => Promise<boolean>;
  busy: boolean;
}) {
  const [status, setStatus] = useState<Status>(r.status),
    [applicable, setApplicable] = useState(r.applicable),
    [evidence, setEvidence] = useState(r.evidenceUrl),
    [verified, setVerified] = useState(Boolean(r.verifiedAt));
  return (
    <details className="registration">
      <summary>
        <div>
          <strong>{registrationLabel(r)}</strong>
          <small>{title}</small>
        </div>
        <span className={`status-tag ${r.status}`}>
          {statusLabels[r.status]}
        </span>
        <span className="evidence-label">
          {r.verifiedAt ? "Evidencia revisada" : "Sin evidencia revisada"}
        </span>
        <Plus size={16} />
      </summary>
      <form
        className="form-grid"
        onSubmit={async (event) => {
          event.preventDefault();
          await save({
            ...r,
            organization:
              r.agency === "PRO"
                ? String(
                    new FormData(event.currentTarget).get("organization") || "",
                  )
                : r.organization,
            status: applicable === "no" ? "not_applicable" : status,
            applicable,
            evidenceUrl: evidence,
            verifiedAt:
              verified &&
              evidence &&
              status === "registered" &&
              applicable === "yes"
                ? r.verifiedAt || new Date().toISOString()
                : "",
            notes: String(new FormData(event.currentTarget).get("notes")),
          });
        }}
      >
        {r.agency === "PRO" && (
          <div className="full">
            <OrganizationField value={r.organization} options={organizations} />
            <p className="muted">
              Identifica dónde está declarado este registro. Elegir una sociedad
              conserva el estado y la evidencia; no crea un registro nuevo.
            </p>
          </div>
        )}
        <label>
          ¿Este registro aplica?
          <select
            value={applicable}
            onChange={(event) => {
              const value = event.target.value as Registration["applicable"];
              setApplicable(value);
              setVerified(false);
              if (value === "no") setStatus("not_applicable");
              else if (status === "not_applicable") setStatus("unchecked");
            }}
          >
            <option value="unknown">Aún no lo sé</option>
            <option value="yes">Sí, aplica</option>
            <option value="no">No aplica</option>
          </select>
        </label>
        <label>
          Estado declarado
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as Status);
              setVerified(false);
            }}
            disabled={applicable === "no"}
          >
            {Object.entries(statusLabels)
              .filter(
                ([key]) => key !== "not_applicable" || applicable === "no",
              )
              .map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
          </select>
        </label>
        <label className="full">
          Enlace al justificante
          <input
            type="url"
            value={evidence}
            maxLength={4000}
            onChange={(e) => {
              setEvidence(e.target.value);
              setVerified(false);
            }}
            placeholder="https://…"
          />
        </label>
        {evidence && (
          <a
            className="source-link full"
            href={/^https:\/\//.test(evidence) ? evidence : undefined}
            target="_blank"
            rel="noreferrer"
          >
            Abrir justificante antes de marcarlo revisado
            <ExternalLink size={15} />
          </a>
        )}
        <label className="check-label full">
          <input
            type="checkbox"
            checked={verified}
            disabled={
              !evidence || status !== "registered" || applicable !== "yes"
            }
            onChange={(e) => setVerified(e.target.checked)}
          />
          He abierto el justificante y comprobado este registro.
        </label>
        <label className="full">
          Notas
          <textarea
            name="notes"
            defaultValue={r.notes}
            rows={2}
            maxLength={10000}
          />
        </label>
        {r.sourceValues.length > 0 && (
          <p className="muted full">
            Declaraciones originales de Notion: {r.sourceValues.join(" / ")}. Se
            conservan aunque actualices el estado.
          </p>
        )}
        <button className="primary" disabled={busy}>
          Guardar registro
          <Save size={16} />
        </button>
      </form>
    </details>
  );
}
function RelationForm({
  entity,
  catalog,
  save,
  busy,
}: {
  entity: Entity;
  catalog: Catalog;
  save: SaveCatalog;
  busy: boolean;
}) {
  const options = catalog.entities.filter((e) =>
    entity.kind === "work"
      ? e.kind === "recording" || e.kind === "release"
      : entity.kind === "recording"
        ? e.kind === "work" || e.kind === "release"
        : entity.kind === "video"
          ? e.kind === "recording"
          : e.kind === "work" || e.kind === "recording",
  );
  return (
    <form
      className="inline-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget),
          target = catalog.entities.find((e) => e.id === data.get("target"));
        if (!target) return;
        let from = entity,
          to = target;
        if (
          target.kind === "release" ||
          (entity.kind === "work" && target.kind === "recording")
        ) {
          from = target;
          to = entity;
        }
        const relation =
          from.kind === "video"
            ? "video_recording"
            : from.kind === "recording"
              ? "recording_work"
              : to.kind === "recording"
                ? "release_recording"
                : "release_work";
        await save({
          ...catalog,
          links: [
            ...catalog.links,
            { id: crypto.randomUUID(), fromId: from.id, toId: to.id, relation },
          ],
        });
      }}
    >
      <label>
        Elegir ficha relacionada
        <select name="target" required>
          <option value="">Selecciona una ficha</option>
          {options.map((e) => (
            <option key={e.id} value={e.id}>
              {kindLabels[e.kind]} · {e.title}
            </option>
          ))}
        </select>
      </label>
      <button disabled={busy}>
        Vincular
        <Link2 size={16} />
      </button>
    </form>
  );
}
