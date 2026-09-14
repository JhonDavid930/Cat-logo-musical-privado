"use client";
import { useId, useState } from "react";
import genreSource from "@/lib/genre-options.json";

export default function GenreField({
  value = "",
  existing = [],
}: {
  value?: string;
  existing?: string[];
}) {
  const inputId = useId();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(value);
  const [custom, setCustom] = useState(false);
  const options = [
    ...new Set([...genreSource.options, ...existing, value].filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "es"));
  const filtered = options.filter(
    (genre) =>
      genre === selected ||
      genre.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  return (
    <div className="genre-field">
      <label htmlFor={inputId + "-search"}>
        Buscar género
        <input
          id={inputId + "-search"}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Opciones de tu base de Notion"
        />
      </label>
      <label htmlFor={inputId}>
        Género
        <select
          id={inputId}
          name={custom ? undefined : "genre"}
          value={custom ? "__custom__" : selected}
          onChange={(event) => {
            setCustom(event.target.value === "__custom__");
            if (event.target.value !== "__custom__")
              setSelected(event.target.value);
          }}
        >
          <option value="">Sin indicar en esta ficha</option>
          {filtered.map((genre) => (
            <option key={genre} value={genre}>
              {genre}
            </option>
          ))}
          <option value="__custom__">Escribir otro género…</option>
        </select>
      </label>
      {custom && (
        <label>
          Otro género
          <input
            name="genre"
            defaultValue={selected}
            maxLength={100}
            required
          />
        </label>
      )}
    </div>
  );
}
