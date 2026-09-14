"use client";
import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { catalogSchema, type Catalog } from "@/lib/catalog";
import { songContextIds } from "@/lib/song-groups";
import { documentLabels, MAX_FILE_BYTES } from "@/lib/file-policy";
import type { SaveCatalog } from "./catalog-app";
import DocumentCard from "./document-card";

export default function FilesPanel({
  entityId,
  catalog,
  save,
  busy,
  onCatalogChange,
}: {
  entityId: string;
  catalog: Catalog;
  save: SaveCatalog;
  busy: boolean;
  onCatalogChange: (catalog: Catalog) => void;
}) {
  const [files, setFiles] = useState<File[]>([]),
    [category, setCategory] =
      useState<keyof typeof documentLabels>("certificate"),
    [uploading, setUploading] = useState(false),
    [status, setStatus] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const ids = songContextIds(catalog, entityId);
  const documents = catalog.documents.filter((document) =>
    ids.has(document.entityId),
  );
  function choose(incoming: File[]) {
    if (files.length + incoming.length > 10) {
      setStatus(
        "Selecciona hasta 10 archivos por tanda. Puedes añadir más después.",
      );
      return;
    }
    if (
      incoming.some((file) => file.size === 0 || file.size > MAX_FILE_BYTES)
    ) {
      setStatus(
        "Cada archivo debe tener contenido y ocupar como máximo 512 MiB.",
      );
      return;
    }
    setFiles((current) => [...current, ...incoming]);
    setStatus("");
  }
  async function upload() {
    setUploading(true);
    let completed = 0;
    try {
      for (const file of files) {
        setStatus(`Subiendo ${completed + 1} de ${files.length}: ${file.name}`);
        const params = new URLSearchParams({
          entityId,
          kind: category,
          name: file.name,
          filename: file.name,
        });
        const response = await fetch(`/api/documents/upload?${params}`, {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream" },
          body: file,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "No se pudo subir.");
        onCatalogChange(catalogSchema.parse(result));
        completed++;
      }
      setStatus(
        `${completed} archivo${completed === 1 ? "" : "s"} guardado${completed === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      setStatus(
        `${completed} guardados. ${error instanceof Error ? error.message : "La subida se ha interrumpido."} Puedes reintentar los pendientes.`,
      );
    } finally {
      setFiles((current) => current.slice(completed));
      if (fileInput.current) fileInput.current.value = "";
      setUploading(false);
    }
  }
  return (
    <section>
      <h2>Todo lo que acompaña a tu música.</h2>
      <p className="muted">
        Guarda varios archivos de cada categoría, enlaces o información escrita.
        Cada documento conserva la canción o versión a la que pertenece.
      </p>
      <div className="panel upload-panel">
        <label>
          Guardar archivos como
          <select
            value={category}
            disabled={uploading}
            onChange={(event) =>
              setCategory(event.target.value as keyof typeof documentLabels)
            }
          >
            {Object.entries(documentLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div
          className="drop-zone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (!uploading) choose(Array.from(event.dataTransfer.files));
          }}
        >
          <Upload size={28} aria-hidden />
          <strong>Arrastra aquí tus archivos</strong>
          <label>
            O selecciona varios archivos
            <input
              ref={fileInput}
              type="file"
              multiple
              disabled={uploading}
              onChange={(event) => {
                choose(Array.from(event.target.files || []));
                event.target.value = "";
              }}
            />
          </label>
          <small>
            Hasta 10 por tanda · 512 MiB por archivo · Sin cuota de suscripción.
          </small>
        </div>
        {files.length > 0 && (
          <ul className="upload-list">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`}>
                <span>{file.name}</span>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() =>
                    setFiles((current) =>
                      current.filter((_, position) => position !== index),
                    )
                  }
                  aria-label={`Quitar ${file.name}`}
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          className="primary"
          disabled={!files.length || uploading || busy}
          onClick={upload}
        >
          {uploading ? "Guardando…" : "Subir archivos"}
          <Upload size={16} />
        </button>
        {status && <p role="status">{status}</p>}
        <p className="muted">
          PDF y texto: lectura interna. Word DOCX y Excel XLSX: lectura hasta 20
          MiB. Audio y vídeo: reproducción según el códec del navegador. Otros
          formatos, incluidos DOC y XLS: descarga del original.
        </p>
      </div>
      <div className="file-grid">
        {documents.map((document) => (
          <DocumentCard
            key={document.id}
            document={document}
            context={
              catalog.entities.find((entity) => entity.id === document.entityId)
                ?.title
            }
          />
        ))}
      </div>
      {!documents.length && (
        <p className="note">
          Aún no hay documentos. Puedes empezar por una letra, un certificado o
          tu máster.
        </p>
      )}
      <form
        className="panel form-grid"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget,
            data = new FormData(form);
          const document = {
            id: crypto.randomUUID(),
            entityId,
            name: String(data.get("name")),
            kind: String(data.get("kind")) as keyof typeof documentLabels,
            url: String(data.get("url") || ""),
            notes: String(data.get("notes") || ""),
          };
          if (
            await save({
              ...catalog,
              documents: [...catalog.documents, document],
            })
          )
            form.reset();
        }}
      >
        <h3 className="full">Añadir información o un enlace</h3>
        <label>
          Nombre
          <input
            name="name"
            required
            maxLength={250}
            placeholder="Certificado de propiedad intelectual"
          />
        </label>
        <label>
          Tipo
          <select name="kind">
            {Object.entries(documentLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="full">
          Enlace al archivo
          <input
            name="url"
            type="url"
            maxLength={4000}
            placeholder="https://… (opcional)"
          />
        </label>
        <label className="full">
          Nota opcional
          <textarea
            name="notes"
            maxLength={10000}
            rows={5}
            placeholder="Escribe aquí la información. No necesitas adjuntar un archivo ni un enlace."
          />
        </label>
        <button className="primary" disabled={busy || uploading}>
          Guardar información
        </button>
      </form>
    </section>
  );
}
