import { authorized } from "@/lib/auth";
import { loadCatalog } from "@/lib/storage";
import { checkedPath, parseRange, FileError } from "@/lib/files";
import { MAX_PREVIEW_BYTES } from "@/lib/file-policy";
import { officePreview } from "@/lib/office-preview";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await authorized()))
    return Response.json({ error: "Inicia sesión." }, { status: 401 });
  const { id } = await params;
  const item = (await loadCatalog()).documents.find((item) => item.id === id);
  if (!item?.file)
    return Response.json({ error: "Archivo no encontrado." }, { status: 404 });
  try {
    const file = item.file;
    const { filename, stat } = await checkedPath(file.id);
    const mode = new URL(request.url).searchParams.get("mode");
    if (mode === "read") {
      if (stat.size > MAX_PREVIEW_BYTES)
        return Response.json({
          error:
            "La lectura interna admite documentos de hasta 20 MiB. Descarga el original.",
        });
      if (file.preview === "docx" || file.preview === "xlsx")
        return Response.json(await officePreview(filename, file.preview));
      if (file.preview === "text") {
        try {
          const text = new TextDecoder("utf-8", { fatal: true }).decode(
            await readFile(filename),
          );
          return Response.json({
            text: text.slice(0, 200000),
            truncated: text.length > 200000,
          });
        } catch {
          return Response.json({
            error: "El texto no está en UTF-8. Descarga el original.",
          });
        }
      }
      return Response.json({
        error: "Usa la descarga original para este formato.",
      });
    }
    const inline =
      mode === "preview" && ["pdf", "audio", "video"].includes(file.preview);
    const range = parseRange(request.headers.get("range"), stat.size);
    const headers = new Headers({
      "Content-Type": inline ? file.mediaType : "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="archivo"; filename*=UTF-8''${encodeURIComponent(file.originalName).replace(/['()]/g, (char) => `%${char.charCodeAt(0).toString(16)}`)}`,
      "Content-Length": String(range ? range.end - range.start + 1 : stat.size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "Content-Security-Policy":
        "default-src 'none'; frame-ancestors 'self'",
    });
    if (range)
      headers.set(
        "Content-Range",
        `bytes ${range.start}-${range.end}/${stat.size}`,
      );
    return new Response(
      Readable.toWeb(
        createReadStream(filename, range || undefined),
      ) as ReadableStream<Uint8Array>,
      { status: range ? 206 : 200, headers },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof FileError ? error.message : "Archivo no disponible.",
      },
      {
        status: error instanceof FileError ? error.status : 404,
        headers:
          error instanceof FileError && error.status === 416
            ? { "Content-Range": `bytes */${item.file.size}` }
            : undefined,
      },
    );
  }
}
