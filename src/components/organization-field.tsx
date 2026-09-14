"use client";
import { useState } from "react";
import { mergeOrganizations } from "@/lib/pro-organizations";
export default function OrganizationField({ value = "", options = [] }: { value?: string; options?: string[] }) {
  const organizations = mergeOrganizations(options,value ? [value] : []).sort((a,b)=>a.localeCompare(b,"es"));
  const [custom, setCustom] = useState(
    Boolean(value && !organizations.includes(value)),
  );
  return (
    <div>
      <label>
        Sociedad concreta
        <select
          name={custom ? undefined : "organization"}
          defaultValue={custom ? "__other__" : value}
          onChange={(event) => setCustom(event.target.value === "__other__")}
        >
          <option value="">Sin especificar</option>
          {organizations.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
          <option value="__other__">Otra sociedad…</option>
        </select>
      </label>
      {custom && (
        <label>
          Nombre de la sociedad
          <input
            name="organization"
            defaultValue={organizations.includes(value) ? "" : value}
            required
            pattern={".*\\S.*"}
            title="Escribe el nombre de la sociedad."
            onInvalid={(event) => event.currentTarget.setCustomValidity("Escribe el nombre de la sociedad antes de guardar.")}
            onInput={(event) => event.currentTarget.setCustomValidity("")}
            maxLength={100}
            placeholder="Nombre de la entidad"
          />
          <small>Escribe un nombre para guardar. Después podrás elegirlo en todas tus canciones.</small>
        </label>
      )}
    </div>
  );
}
