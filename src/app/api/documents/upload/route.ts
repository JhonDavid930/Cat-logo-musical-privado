import { authorized, sameOrigin } from "@/lib/auth";
import { documentSchema } from "@/lib/catalog";
import { loadCatalog, saveCatalog } from "@/lib/storage";
import { blobPath, receiveFile, FileError } from "@/lib/files";
import { writeFile, unlink } from "node:fs/promises";
import { ConflictError } from "@/lib/database";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!(await authorized()))
    return Response.json({ error: "Inicia sesión." }, { status: 401 });
  if (!sameOrigin(request))
    return Response.json({ error: "Origen no autorizado." }, { status: 403 });
  let file;
  try {
    const params = new URL(request.url).searchParams;
    const meta = documentSchema
      .omit({ file: true })
      .parse({
        id: crypto.randomUUID(),
        entityId: params.get("entityId"),
        kind: params.get("kind"),
        name: params.get("name"),
        url: "",
        notes: "",
      });
    const before = await loadCatalog();
    if (!before.entities.some((entity) => entity.id === meta.entityId))
      throw new FileError("La canción ya no existe.");
    file = await receiveFile(request, params.get("filename") || "");
    await writeFile(blobPath(file.id) + ".json", JSON.stringify(file), {
      flag: "wx",
      mode: 0o600,
    });
    const current = await loadCatalog();
    if (!current.entities.some((entity) => entity.id === meta.entityId))
      throw new FileError("La canción ya no existe.");
    return Response.json(
      await saveCatalog({
        ...current,
        documents: [...current.documents, { ...meta, file }],
      }),
    );
  } catch (error) {
    if (file) {
      await unlink(blobPath(file.id)).catch(() => {});
      await unlink(blobPath(file.id) + ".json").catch(() => {});
    }
    return Response.json(
      {
        error:
          error instanceof FileError || error instanceof ConflictError
            ? error.message
            : "No se pudo subir el archivo. Comprueba nombre y categoría.",
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
  }
}
