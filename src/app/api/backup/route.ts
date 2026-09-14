import { authorized, sameOrigin } from "@/lib/auth";
import { loadCatalog, saveCatalog } from "@/lib/storage";
import {
  createFullBackup,
  prepareFullRestore,
  MAX_BACKUP_BYTES,
} from "@/lib/full-backup";
import { receiveFile, blobPath, FileError } from "@/lib/files";
import { ConflictError } from "@/lib/database";
import { Readable } from "node:stream";
import { unlink } from "node:fs/promises";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!(await authorized()))
    return Response.json({ error: "Inicia sesión." }, { status: 401 });
  try {
    return new Response(
      Readable.toWeb(
        await createFullBackup(await loadCatalog()),
      ) as ReadableStream<Uint8Array>,
      {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="catalogo-completo-${new Date().toISOString().slice(0, 10)}.zip"`,
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch {
    return Response.json(
      {
        error:
          "No se pudo preparar la copia completa. Comprueba que los archivos originales están disponibles.",
      },
      { status: 500 },
    );
  }
}
export async function POST(request: Request) {
  if (!(await authorized()))
    return Response.json({ error: "Inicia sesión." }, { status: 401 });
  if (!sameOrigin(request))
    return Response.json({ error: "Origen no autorizado." }, { status: 403 });
  let archive;
  let prepared;
  try {
    const current = await loadCatalog();
    archive = await receiveFile(request, "restore.zip", MAX_BACKUP_BYTES);
    prepared = await prepareFullRestore(blobPath(archive.id));
    const result = await saveCatalog({
      ...prepared.catalog,
      revision: current.revision,
    });
    prepared = undefined;
    return Response.json(result);
  } catch (error) {
    await prepared?.cleanup();
    return Response.json(
      {
        error:
          error instanceof FileError || error instanceof ConflictError
            ? error.message
            : "Copia no válida. Se han conservado los datos actuales.",
      },
      {
        status:
          error instanceof FileError
            ? error.status
            : error instanceof ConflictError
              ? 409
              : 400,
      },
    );
  } finally {
    if (archive) await unlink(blobPath(archive.id)).catch(() => {});
  }
}
