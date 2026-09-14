"use client";
import { useState } from "react";
import { catalogSchema, type Catalog } from "@/lib/catalog";
export default function FullBackupPanel({
  onCatalogChange,
}: {
  onCatalogChange: (catalog: Catalog) => void;
}) {
  const [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <article className="panel full-backup-panel">
      <h2>Copia completa con archivos</h2>
      <p>
        Descarga un ZIP con el catálogo y todos los archivos subidos. Conserva
        los originales, los créditos, las notas y las relaciones. Los enlaces
        externos se guardan como enlaces.
      </p>
      <a className="button primary" href="/api/backup">
        Descargar copia completa ZIP
      </a>
      <label>
        Recuperar copia completa ZIP
        <input
          type="file"
          accept=".zip"
          disabled={busy}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            if (file.size > 8 * 1024 * 1024 * 1024) {
              setStatus(
                "La recuperación desde el navegador admite copias de hasta 8 GiB.",
              );
              return;
            }
            if (
              !window.confirm(
                "¿Recuperar esta copia completa? Sustituirá las fichas actuales. Descarga primero una copia de seguridad de lo que tienes.",
              )
            )
              return;
            setBusy(true);
            setStatus("Subiendo y verificando la copia completa…");
            try {
              const response = await fetch("/api/backup", {
                method: "POST",
                headers: { "Content-Type": "application/zip" },
                body: file,
              });
              const result = await response.json();
              if (!response.ok) throw new Error(result.error);
              onCatalogChange(catalogSchema.parse(result));
              setStatus(
                "Copia completa recuperada. Se han comprobado los archivos.",
              );
            } catch (error) {
              setStatus(
                error instanceof Error
                  ? error.message
                  : "No se pudo recuperar la copia.",
              );
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      <p className="muted">
        Recuperación desde el navegador hasta 8 GiB. Necesita espacio libre para
        la copia y sus archivos. Las copias completas sirven tanto en local como
        en la instalación Docker.
      </p>
      {status && <p role="status">{status}</p>}
    </article>
  );
}
