import { ZipFile } from "yazl";
import yauzl from "yauzl";
import { createWriteStream } from "node:fs";
import { unlink, writeFile, open } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import { catalogSchema, type Catalog } from "./catalog";
import {
  blobPath,
  checkedPath,
  classifyFile,
  FileError,
  hashFile,
  validateFileReferences,
} from "./files";
import { MAX_FILE_BYTES } from "./file-policy";

export const MAX_BACKUP_BYTES = 8 * 1024 * 1024 * 1024;
export async function createFullBackup(catalog: Catalog) {
  await validateFileReferences(catalog);
  const archive = new ZipFile();
  const output = archive.outputStream as Readable;
  archive.on("error", (error) => output.destroy(error));
  archive.addBuffer(Buffer.from(JSON.stringify(catalog)), "catalog.json");
  const seen = new Set<string>();
  for (const document of catalog.documents) {
    if (!document.file || seen.has(document.file.id)) continue;
    seen.add(document.file.id);
    const { filename } = await checkedPath(document.file.id);
    archive.addFile(filename, `files/${document.file.id}`, { compress: false });
  }
  archive.end();
  return output;
}

export async function prepareFullRestore(filename: string) {
  const staged = new Map<string, string>();
  const cleanup = async () => {
    for (const id of staged.values()) {
      await unlink(blobPath(id)).catch(() => {});
      await unlink(blobPath(id) + ".json").catch(() => {});
    }
  };
  let metadata: Buffer | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      yauzl.open(
        filename,
        { lazyEntries: true, validateEntrySizes: true, strictFileNames: true },
        (error, zip) => {
          if (error) return reject(error);
          let count = 0,
            total = 0;
          const seen = new Set<string>();
          const fail = (error: unknown) => {
            zip.close();
            reject(error);
          };
          zip.on("error", fail);
          zip.on("end", resolve);
          zip.on("entry", (entry: yauzl.Entry) => {
            void (async () => {
              total += entry.uncompressedSize;
              if (
                ++count > 30001 ||
                total > MAX_BACKUP_BYTES ||
                entry.isEncrypted() ||
                seen.has(entry.fileName)
              )
                throw new FileError(
                  "La copia excede los límites o contiene entradas duplicadas/cifradas.",
                );
              seen.add(entry.fileName);
              const isCatalog = entry.fileName === "catalog.json";
              if (
                (!isCatalog &&
                  !/^files\/[a-f0-9-]{36}$/.test(entry.fileName)) ||
                entry.uncompressedSize >
                  (isCatalog ? 10_000_000 : MAX_FILE_BYTES)
              )
                throw new FileError("Estructura de copia no válida.");
              const stream = await new Promise<import("node:stream").Readable>(
                (resolve, reject) =>
                  zip.openReadStream(entry, (error, stream) =>
                    error ? reject(error) : resolve(stream!),
                  ),
              );
              if (isCatalog) {
                const chunks: Buffer[] = [];
                for await (const chunk of stream)
                  chunks.push(Buffer.from(chunk));
                metadata = Buffer.concat(chunks);
              } else {
                const oldId = entry.fileName.slice(6);
                blobPath(oldId);
                const newId = randomUUID();
                staged.set(oldId, newId);
                await pipeline(
                  stream,
                  createWriteStream(blobPath(newId), {
                    flags: "wx",
                    mode: 0o600,
                  }),
                );
              }
              zip.readEntry();
            })().catch(fail);
          });
          zip.readEntry();
        },
      );
    });
    if (!metadata) throw new FileError("La copia no contiene el catálogo.");
    const catalog = catalogSchema.parse(JSON.parse(metadata.toString("utf8")));
    const used = new Set<string>();
    for (const document of catalog.documents) {
      if (!document.file) continue;
      const oldId = document.file.id,
        newId = staged.get(oldId);
      if (!newId)
        throw new FileError("La copia está incompleta: falta un archivo.");
      used.add(oldId);
      const { filename: stagedPath, stat } = await checkedPath(newId);
      if (
        stat.size !== document.file.size ||
        (await hashFile(stagedPath)) !== document.file.sha256
      )
        throw new FileError(
          "El contenido de la copia no supera la comprobación de integridad.",
        );
      const handle = await open(stagedPath, "r");
      const header = Buffer.alloc(Math.min(stat.size, 4096));
      try {
        await handle.read(header, 0, header.length, 0);
      } finally {
        await handle.close();
      }
      const type = classifyFile(document.file.originalName, header);
      if (
        type.mediaType !== document.file.mediaType ||
        type.preview !== document.file.preview
      )
        throw new FileError("El tipo de archivo no coincide con su contenido.");
      document.file = { ...document.file, id: newId };
      await writeFile(
        blobPath(newId) + ".json",
        JSON.stringify(document.file),
        { mode: 0o600 },
      );
    }
    if (used.size !== staged.size)
      throw new FileError("La copia contiene archivos sin ficha.");
    await validateFileReferences(catalog);
    return { catalog, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
