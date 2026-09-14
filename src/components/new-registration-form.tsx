"use client";
import { useId, useState } from "react";
import type { Catalog } from "@/lib/catalog";
import type { SaveCatalog } from "./catalog-app";
import OrganizationField from "./organization-field";
export default function NewRegistrationForm({
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
  const [agency, setAgency] = useState("PRO");
  const id = useId();
  return (
    <form
      className="form-grid"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        await save({
          ...catalog,
          registrations: [
            ...catalog.registrations,
            {
              id: crypto.randomUUID(),
              entityId,
              agency,
              organization:
                agency === "PRO" ? String(data.get("organization") || "") : "",
              status: "unchecked",
              applicable: "unknown",
              evidenceUrl: "",
              verifiedAt: "",
              notes: "",
              sourceValues: [],
            },
          ],
        });
      }}
    >
      <label>
        Tipo de registro
        <input
          name="agency"
          list={id}
          value={agency}
          onChange={(event) => setAgency(event.target.value)}
          required
          maxLength={100}
        />
        <datalist id={id}>
          {[
            "PRO",
            "MLC",
            "Songtrust",
            "SoundExchange",
            "Luminate",
            "Mediabase",
            "Propiedad intelectual",
          ].map((value) => (
            <option key={value} value={value} />
          ))}
        </datalist>
      </label>
      {agency === "PRO" && <OrganizationField options={catalog.proOrganizations} />}
      <button disabled={busy}>Añadir entidad</button>
    </form>
  );
}
