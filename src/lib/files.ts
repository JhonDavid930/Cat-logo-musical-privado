import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  mkdir,
  open,
  unlink,
  lstat,
  readFile,
  realpath,
} from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { documentSchema, type Catalog } from "./catalog";
import { MAX_FILE_BYTES } from "./file-policy";

export type StoredFile = NonNullable<Catalog["documents"][number]["file"]>;
export class FileError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function filesDirectory() {
  return path.resolve(
    /* turbopackIgnore: true */ process.env.CATALOG_FILES_DIR ||
      path.join(
        process.env.CATALOG_DATA_DIR || path.join(process.cwd(), "private"),
        "files",
      ),
  );
}
export function blobPath(id: string) {
  if (!z.string().uuid().safeParse(id).success)
    throw new FileError("Identificador de archivo no válido.");
  return path.join(filesDirectory(), id);
}
export async function checkedPath(id: string) {
  const filename = blobPath(id);
  const stat = await lstat(filename);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    path.dirname(await realpath(filename)) !==
      (await realpath(/* turbopackIgnore: true */ filesDirectory()))
  )
    throw new FileError("Archivo no disponible.", 404);
  return { filename, stat };
}
export async function hashFile(filename: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filename)) hash.update(chunk);
  return hash.digest("hex");
}

export function classifyFile(
  name: string,
  header: Buffer,
): Pick<StoredFile, "mediaType" | "preview"> {
  const extension = path.extname(name).toLowerCase();
  const ascii = header.toString("latin1");
  const matches = (valid: boolean) => {
    if (!valid)
      throw new FileError(
        "El contenido no coincide con la extensión del archivo.",
      );
  };
  if (extension === ".pdf") {
    matches(ascii.startsWith("%PDF-"));
    return { mediaType: "application/pdf", preview: "pdf" };
  }
  if ([".txt", ".md", ".csv", ".lrc", ".json"].includes(extension)) {
    matches(!header.includes(0));
    return { mediaType: "text/plain", preview: "text" };
  }
  if ([".docx", ".xlsx"].includes(extension)) {
    matches(header.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4])));
    return {
      mediaType: "application/octet-stream",
      preview: extension === ".docx" ? "docx" : "xlsx",
    };
  }
  if (extension === ".wav") {
    matches(ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WAVE");
    return { mediaType: "audio/wav", preview: "audio" };
  }
  if (extension === ".mp3") {
    matches(
      ascii.startsWith("ID3") ||
        (header[0] === 255 && (header[1] & 224) === 224),
    );
    return { mediaType: "audio/mpeg", preview: "audio" };
  }
  if (extension === ".flac") {
    matches(ascii.startsWith("fLaC"));
    return { mediaType: "audio/flac", preview: "audio" };
  }
  if ([".ogg", ".oga"].includes(extension)) {
    matches(ascii.startsWith("OggS"));
    return { mediaType: "audio/ogg", preview: "audio" };
  }
  if ([".mp4", ".m4a"].includes(extension)) {
    matches(ascii.slice(4, 8) === "ftyp");
    return {
      mediaType: extension === ".mp4" ? "video/mp4" : "audio/mp4",
      preview: extension === ".mp4" ? "video" : "audio",
    };
  }
  if (extension === ".webm") {
    matches(header.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163])));
    return { mediaType: "video/webm", preview: "video" };
  }
  return { mediaType: "application/octet-stream", preview: "download" };
}

export async function receiveFile(
  request: Request,
  originalName: string,
  maximum = MAX_FILE_BYTES,
): Promise<StoredFile> {
  if (
    !originalName ||
    originalName.length > 250 ||
    /[\\/\x00-\x1f\x7f]/.test(originalName)
  )
    throw new FileError("Nombre de archivo no válido.");
  if (!request.body) throw new FileError("Selecciona un archivo.");
  if (Number(request.headers.get("content-length")) > maximum)
    throw new FileError(`Máximo ${maximum / 1024 / 1024} MiB por subida.`, 413);
  await mkdir(filesDirectory(), { recursive: true, mode: 0o700 });
  const id = randomUUID(),
    filename = blobPath(id);
  const handle = await open(filename, "wx", 0o600);
  const reader = request.body.getReader();
  let size = 0,
    header = Buffer.alloc(0);
  const hash = createHash("sha256");
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum)
        throw new FileError(
          `Máximo ${maximum / 1024 / 1024} MiB por subida.`,
          413,
        );
      if (header.length < 4096)
        header = Buffer.concat([
          header,
          Buffer.from(value).subarray(0, 4096 - header.length),
        ]);
      hash.update(value);
      let offset = 0;
      while (offset < value.length) {
        const result = await handle.write(value, offset, value.length - offset);
        offset += result.bytesWritten;
      }
    }
    if (!size) throw new FileError("El archivo está vacío.");
    const file = {
      id,
      originalName,
      size,
      sha256: hash.digest("hex"),
      ...classifyFile(originalName, header),
    };
    await handle.sync();
    await handle.close();
    return file;
  } catch (error) {
    await reader.cancel().catch(() => {});
    await handle.close().catch(() => {});
    await unlink(filename).catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}

export async function validateFileReferences(catalog: Catalog) {
  for (const document of catalog.documents) {
    if (!document.file) continue;
    const { filename, stat } = await checkedPath(document.file.id);
    if (stat.size !== document.file.size)
      throw new FileError(
        "Faltan archivos de esta copia. Restaura la copia completa.",
      );
    const manifest = JSON.parse(await readFile(filename + ".json", "utf8"));
    const schema = documentSchema.shape.file.unwrap();
    if (
      JSON.stringify(schema.parse(manifest)) !==
      JSON.stringify(schema.parse(document.file))
    )
      throw new FileError(
        "Los metadatos del archivo no coinciden con el original guardado.",
      );
  }
}

export async function removeStoredFile(id: string) {
  const filename = blobPath(id);
  await unlink(filename).catch(() => {});
  await unlink(`${filename}.json`).catch(() => {});
}

export function parseRange(value: string | null, size: number) {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2]))
    throw new FileError("Rango no válido.", 416);
  const start = match[1]
    ? Number(match[1])
    : Math.max(0, size - Number(match[2]));
  const end =
    match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start > end ||
    start >= size
  )
    throw new FileError("Rango no válido.", 416);
  return { start, end };
}
