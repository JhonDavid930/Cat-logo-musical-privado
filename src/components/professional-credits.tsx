"use client";
import { useId, useState } from "react";
import { ExternalLink } from "lucide-react";
import {
  kindLabels,
  relatedIds,
  type Catalog,
  type Credit,
} from "@/lib/catalog";
import type { SaveCatalog } from "./catalog-app";
export const professionalRoles = [
  "Compositor",
  "Letrista",
  "Productor",
  "Mastering",
  "Mezcla",
  "Intérprete",
  "Vocalista",
  "Arreglista",
  "Músico de sesión",
  "Ingeniero de grabación",
  "Director",
  "Dirección de fotografía",
  "Montaje",
  "Diseño gráfico",
  "Artista principal",
  "Autor (según fuente)",
];

export function CreditSummary({
  catalog,
  entityId,
}: {
  catalog: Catalog;
  entityId: string;
}) {
  const ids = relatedIds(catalog, entityId);
  const credits = catalog.credits.filter(
    (credit) => ids.has(credit.entityId) && credit.scope === "professional",
  );
  return (
    <section className="panel">
      <p className="eyebrow">EL EQUIPO</p>
      <h2>Créditos profesionales</h2>
      {!credits.length && <p>Aún no hay créditos profesionales añadidos.</p>}
      {credits.map((credit) => (
        <div className="credit-row" key={credit.id}>
          <strong>{credit.name}</strong>
          <span>{credit.role}</span>
          <small>
            {
              kindLabels[
                catalog.entities.find(
                  (entity) => entity.id === credit.entityId,
                )!.kind
              ]
            }{" "}
            ·{" "}
            {
              catalog.entities.find((entity) => entity.id === credit.entityId)
                ?.title
            }
          </small>
          {credit.sourceUrl && (
            <a
              href={credit.sourceUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`Fuente de ${credit.name}`}
            >
              <ExternalLink size={16} />
            </a>
          )}
        </div>
      ))}
      <p className="muted">
        Estos roles describen la participación profesional. No asignan derechos
        ni porcentajes.
      </p>
    </section>
  );
}

export default function ProfessionalCredits({
  catalog,
  entityId,
  save,
  busy,
}: {
  catalog: Catalog;
  entityId: string;
  save: SaveCatalog;
  busy: boolean;
}) {
  const ids = relatedIds(catalog, entityId);
  const entities = catalog.entities.filter((entity) => ids.has(entity.id));
  const credits = catalog.credits.filter(
    (credit) => ids.has(credit.entityId) && credit.scope === "professional",
  );
  const people = [
    ...new Set(catalog.credits.map((credit) => credit.name)),
  ].sort((a, b) => a.localeCompare(b, "es"));
  return (
    <section className="panel">
      <h2>Personas y roles</h2>
      <p className="muted">
        Una persona puede tener varios roles y un rol puede tener varias
        personas. Elige la composición, grabación o vídeo al que corresponde
        cada participación.
      </p>
      {credits.map((credit) => (
        <ProfessionalCreditForm
          key={credit.id + catalog.revision}
          credit={credit}
          entities={entities}
          people={people}
          busy={busy}
          save={async (next) =>
            save({
              ...catalog,
              credits: catalog.credits.map((item) =>
                item.id === credit.id ? next : item,
              ),
            })
          }
        />
      ))}
      <ProfessionalCreditForm
        key={`new-${catalog.revision}`}
        credit={{
          id: crypto.randomUUID(),
          entityId,
          name: "",
          role: "Productor",
          scope: "professional",
          share: null,
          sourceUrl: "",
        }}
        entities={entities}
        people={people}
        busy={busy}
        isNew
        save={async (next) =>
          save({ ...catalog, credits: [...catalog.credits, next] })
        }
      />
    </section>
  );
}

function ProfessionalCreditForm({
  credit,
  entities,
  people,
  busy,
  isNew,
  save,
}: {
  credit: Credit;
  entities: Catalog["entities"];
  people: string[];
  busy: boolean;
  isNew?: boolean;
  save: (credit: Credit) => Promise<boolean>;
}) {
  const id = useId();
  const [person, setPerson] = useState(credit.name);
  const [custom, setCustom] = useState(
    !credit.name || !people.includes(credit.name),
  );
  return (
    <form
      className="credit-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const name = String(data.get("name"));
        await save({
          ...credit,
          entityId: String(data.get("entityId")),
          name,
          role: String(data.get("role")),
          scope: "professional",
          share: null,
          sourceUrl: name === credit.name ? credit.sourceUrl : "",
        });
      }}
    >
      <label>
        Persona
        <select
          value={custom ? "__new__" : person}
          onChange={(event) => {
            setCustom(event.target.value === "__new__");
            if (event.target.value !== "__new__") setPerson(event.target.value);
          }}
        >
          {people.map((name) => (
            <option value={name} key={name}>
              {name}
            </option>
          ))}
          <option value="__new__">Escribir un nombre…</option>
        </select>
      </label>
      {custom ? (
        <label>
          Nombre de la persona
          <input
            name="name"
            maxLength={200}
            defaultValue={credit.name}
            required
            list={id}
          />
          <datalist id={id}>
            {people.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>
      ) : (
        <input type="hidden" name="name" value={person} />
      )}
      <label>
        Rol
        <select name="role" defaultValue={credit.role}>
          {[...new Set([...professionalRoles, credit.role])].map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </label>
      <label>
        Participa en
        <select name="entityId" defaultValue={credit.entityId}>
          {entities.map((entity) => (
            <option key={entity.id} value={entity.id}>
              {kindLabels[entity.kind]} · {entity.title}
            </option>
          ))}
        </select>
      </label>
      <button disabled={busy}>
        {isNew ? "Añadir crédito" : "Guardar crédito"}
      </button>
    </form>
  );
}
