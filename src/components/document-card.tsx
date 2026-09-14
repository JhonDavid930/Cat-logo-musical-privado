"use client";
import { useEffect, useState } from "react";
import { Download, ExternalLink, FileText, X } from "lucide-react";
import type { Catalog } from "@/lib/catalog";
import {
  documentLabels,
  previewLabels,
  fileSizeLabel,
} from "@/lib/file-policy";
type Preview = {
  text?: string;
  truncated?: boolean;
  error?: string;
  note?: string;
  sheets?: { name: string; rows: { number: number; values: string[] }[] }[];
};

export default function DocumentCard({
  document,
  context,
  open,
}: {
  document: Catalog["documents"][number];
  context?: string;
  open?: () => void;
}) {
  const [show, setShow] = useState(false);
  const [result, setResult] = useState<Preview | null>(null);
  const [mediaError, setMediaError] = useState(false);
  const file = document.file,
    endpoint = `/api/documents/${document.id}`;
  useEffect(() => {
    if (!show || !file || !["text", "docx", "xlsx"].includes(file.preview))
      return;
    const controller = new AbortController();
    fetch(`${endpoint}?mode=read`, { signal: controller.signal })
      .then((response) => response.json())
      .then(setResult)
      .catch((error) => {
        if (error.name !== "AbortError")
          setResult({
            error: "No se pudo abrir la vista previa. Descarga el original.",
          });
      });
    return () => controller.abort();
  }, [show, file, endpoint]);
  return (
    <article className="file-card">
      <FileText size={22} aria-hidden />
      <small>
        {documentLabels[document.kind]}
        {file
          ? ` · ${previewLabels[file.preview]} · ${fileSizeLabel(file.size)}`
          : ""}
      </small>
      <h3>{document.name}</h3>
      {context && <p className="muted">{context}</p>}
      {document.notes && <p className="preserve-text">{document.notes}</p>}
      {file && (
        <>
          <small>{file.originalName}</small>
          <div className="file-actions">
            {file.preview !== "download" && (
              <button
                className="primary"
                onClick={() => {
                  setShow(!show);
                  setMediaError(false);
                }}
              >
                {show
                  ? "Cerrar vista previa"
                  : ["audio", "video"].includes(file.preview)
                    ? "Reproducir"
                    : "Leer aquí"}
                {show && <X size={16} />}
              </button>
            )}
            <a className="button" href={endpoint} download={file.originalName}>
              <Download size={16} />
              Descargar original
            </a>
          </div>
        </>
      )}
      {file?.preview === "download" && (
        <p className="note">
          Este formato se conserva completo. Ábrelo en tu aplicación después de
          descargarlo.
        </p>
      )}
      {document.url && (
        <a
          className="button"
          href={document.url}
          target="_blank"
          rel="noreferrer"
        >
          Abrir enlace externo
          <ExternalLink size={16} />
        </a>
      )}
      {open && (
        <button className="subtle" onClick={open}>
          Ver canción
        </button>
      )}
      {show && file && (
        <div className="document-preview">
          {file.preview === "pdf" && (
            <>
              <iframe
                title={`PDF: ${document.name}`}
                src={`${endpoint}?mode=preview`}
              />
              <p className="muted">
                Si el navegador no muestra el PDF, usa Descargar original.
              </p>
            </>
          )}
          {file.preview === "audio" && (
            <audio
              controls
              preload="metadata"
              src={`${endpoint}?mode=preview`}
              onError={() => setMediaError(true)}
            />
          )}
          {file.preview === "video" && (
            <video
              controls
              playsInline
              preload="metadata"
              src={`${endpoint}?mode=preview`}
              onError={() => setMediaError(true)}
            />
          )}
          {["audio", "video"].includes(file.preview) && (
            <p className="muted">
              {mediaError
                ? "Tu navegador no puede reproducir este archivo. Descarga el original y ábrelo en tu reproductor."
                : "La reproducción depende del formato y códec admitidos por tu navegador."}
            </p>
          )}
          {["text", "docx", "xlsx"].includes(file.preview) &&
            (!result ? (
              <p role="status">Preparando lectura…</p>
            ) : (
              <>
                {result.error && <p role="status">{result.error}</p>}
                {result.note && <p className="muted">{result.note}</p>}
                {result.text !== undefined && <pre>{result.text}</pre>}
                {result.truncated && (
                  <p>
                    Vista abreviada a 200.000 caracteres. Descarga el original
                    para leerlo completo.
                  </p>
                )}
                {result.sheets?.map((sheet, index) => (
                  <section key={index}>
                    <h4>{sheet.name}</h4>
                    <div
                      className="sheet-scroll"
                      tabIndex={0}
                      role="region"
                      aria-label={`Tabla ${sheet.name}`}
                    >
                      <table>
                        <tbody>
                          {sheet.rows.map((row) => (
                            <tr key={row.number}>
                              <th scope="row">{row.number}</th>
                              {row.values.map((value, column) => (
                                <td key={column}>{value}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))}
              </>
            ))}
        </div>
      )}
    </article>
  );
}
