import { authorized, sameOrigin } from "@/lib/auth";
import { catalogSchema } from "@/lib/catalog";
import { ConflictError } from "@/lib/database";
import { loadCatalog, saveCatalog } from "@/lib/storage";
import { boundedJson, RequestBodyError } from "@/lib/request-json";
import {
  validateFileReferences,
  removeStoredFile,
  FileError,
} from "@/lib/files";
import { changedReleaseCodeIssue } from "@/lib/release-codes";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!(await authorized()))
    return Response.json({ error: "Inicia sesión." }, { status: 401 });
  return Response.json(await loadCatalog(), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
export async function PUT(request: Request) {
  if (!(await authorized()))
    return Response.json({ error: "Inicia sesión." }, { status: 401 });
  if (!sameOrigin(request))
    return Response.json({ error: "Origen no autorizado." }, { status: 403 });
  try {
    const parsed = catalogSchema.safeParse(
      await boundedJson(request, 10_000_000),
    );
    if (!parsed.success)
      return Response.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    await validateFileReferences(parsed.data);
    const previous = await loadCatalog();
    const codeIssue = changedReleaseCodeIssue(parsed.data, previous);
    if (codeIssue) return Response.json({ error: codeIssue }, { status: 400 });
    const retainedFiles = new Set(
      parsed.data.documents.flatMap((document) =>
        document.file ? [document.file.id] : [],
      ),
    );
    const removedFiles = previous.documents.flatMap((document) =>
      document.file && !retainedFiles.has(document.file.id)
        ? [document.file.id]
        : [],
    );
    const saved = await saveCatalog(parsed.data);
    await Promise.all(removedFiles.map(removeStoredFile));
    return Response.json(saved);
  } catch (error) {
    if (error instanceof FileError)
      return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof RequestBodyError)
      return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof ConflictError)
      return Response.json({ error: error.message }, { status: 409 });
    if (error instanceof SyntaxError)
      return Response.json(
        { error: "El archivo no contiene JSON válido." },
        { status: 400 },
      );
    return Response.json(
      {
        error:
          "No se pudo guardar. La operación se ha cancelado sin cambios parciales.",
      },
      { status: 500 },
    );
  }
}
