import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ZipFile } from "yazl";
import { catalogSchema, emptyCatalog, type Entity } from "../src/lib/catalog";
import {
  blobPath,
  checkedPath,
  classifyFile,
  filesDirectory,
  parseRange,
  receiveFile,
  validateFileReferences,
} from "../src/lib/files";
import { createFullBackup, prepareFullRestore } from "../src/lib/full-backup";
import { genreSources, genreSummary } from "../src/lib/genres";
import { enrichSourceCredits } from "../src/lib/import-credits";
import { openDatabase, readCatalog, writeCatalog } from "../src/lib/database";
import { officePreview } from "../src/lib/office-preview";
import ExcelJS from "exceljs";

const work: Entity = {
  id: randomUUID(),
  kind: "work",
  title: "Canción sintética",
  code: "",
  genre: "",
  year: "",
  language: "",
  lyrics: "",
  notes: "",
  url: "",
  sourceUrls: [],
  publication: "unchecked",
};
function fixture() {
  return {
    ...structuredClone(emptyCatalog),
    entities: [structuredClone(work)],
  };
}
async function zipBuffer(entries: Record<string, Buffer | string>) {
  const zip = new ZipFile();
  for (const [name, content] of Object.entries(entries))
    zip.addBuffer(Buffer.from(content), name);
  zip.end();
  const chunks: Buffer[] = [];
  for await (const chunk of zip.outputStream as import("node:stream").Readable)
    chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

test("varios adjuntos y notas sobreviven SQL y ZIP con integridad binaria", async () => {
  process.env.CATALOG_FILES_DIR = await mkdtemp(
    path.join(tmpdir(), "da-files-unit-"),
  );
  const catalog = fixture();
  for (const name of ["letra.txt", "segunda.txt"]) {
    const file = await receiveFile(
      new Request("https://test", {
        method: "POST",
        body: "Texto de prueba ñ",
      }),
      name,
    );
    await writeFile(blobPath(file.id) + ".json", JSON.stringify(file));
    catalog.documents.push({
      id: randomUUID(),
      entityId: work.id,
      name,
      kind: "lyrics",
      url: "",
      notes: "",
      file,
    });
  }
  catalog.documents.push({
    id: randomUUID(),
    entityId: work.id,
    name: "Información escrita",
    kind: "certificate",
    url: "",
    notes: "Sin archivo ni enlace",
  });
  const databasePath = path.join(filesDirectory(), "test.sqlite");
  let db = openDatabase(databasePath);
  const saved = writeCatalog(db, catalog);
  db.close();
  db = openDatabase(databasePath);
  assert.equal(readCatalog(db).documents.length, 3);
  await validateFileReferences(saved);
  const chunks: Buffer[] = [];
  for await (const chunk of await createFullBackup(saved))
    chunks.push(Buffer.from(chunk));
  const archive = path.join(filesDirectory(), "backup.zip");
  await writeFile(archive, Buffer.concat(chunks));
  const restored = await prepareFullRestore(archive);
  assert.equal(restored.catalog.documents.length, 3);
  assert.notEqual(
    restored.catalog.documents[0].file!.id,
    saved.documents[0].file!.id,
  );
  assert.equal(
    await readFile(blobPath(restored.catalog.documents[0].file!.id), "utf8"),
    "Texto de prueba ñ",
  );
  await validateFileReferences(restored.catalog);
  const broken = structuredClone(saved);
  broken.documents[0].file!.mediaType = "application/pdf";
  await assert.rejects(validateFileReferences(broken));
  const corrupt = structuredClone(saved);
  corrupt.documents[0].file!.sha256 = "0".repeat(64);
  const entries: Record<string, Buffer | string> = {
    "catalog.json": JSON.stringify(corrupt),
  };
  for (const document of saved.documents)
    if (document.file)
      entries[`files/${document.file.id}`] = await readFile(
        blobPath(document.file.id),
      );
  const invalid = path.join(filesDirectory(), "invalid.zip");
  await writeFile(invalid, await zipBuffer(entries));
  await assert.rejects(prepareFullRestore(invalid), /integridad/);
  assert.equal(readCatalog(db).revision, saved.revision);
  await restored.cleanup();
  db.close();
});

test("valida nombres, contenido, límites y rangos sin cargar binarios completos", async () => {
  assert.throws(() => blobPath("../../secret"));
  assert.throws(() => classifyFile("fake.pdf", Buffer.from("<script>")));
  assert.deepEqual(parseRange("bytes=1-3", 10), { start: 1, end: 3 });
  assert.deepEqual(parseRange("bytes=-3", 10), { start: 7, end: 9 });
  for (const range of ["bytes=50-", "bytes=3-1", "bytes=0-1,3-4", "bytes=-0"])
    assert.throws(() => parseRange(range, 10));
  await assert.rejects(
    receiveFile(
      new Request("https://test", { method: "POST", body: "123456" }),
      "test.txt",
      5,
    ),
    /Máximo/,
  );
  await assert.rejects(
    receiveFile(
      new Request("https://test", { method: "POST", body: "x" }),
      "../test.txt",
    ),
    /Nombre/,
  );
});

test("géneros de versiones se muestran todos sin modificar la composición", () => {
  const catalog = fixture();
  const first = {
      ...work,
      id: randomUUID(),
      kind: "recording" as const,
      genre: "Afrobeat",
    },
    second = { ...first, id: randomUUID(), genre: "Reparto" };
  catalog.entities.push(first, second);
  catalog.links.push(
    ...[first, second].map((entity) => ({
      id: randomUUID(),
      fromId: entity.id,
      toId: work.id,
      relation: "recording_work" as const,
    })),
  );
  assert.equal(genreSummary(catalog, work.id), "Afrobeat · Reparto");
  assert.equal(genreSources(catalog, work.id).length, 2);
  assert.equal(catalog.entities[0].genre, "");
});

test("roles múltiples no conceden porcentajes y la importación es idempotente", () => {
  const catalog = fixture();
  for (const role of ["Productor", "Mastering", "Mezcla"])
    catalog.credits.push({
      id: randomUUID(),
      entityId: work.id,
      name: "Persona sintética",
      role,
      scope: "professional",
      share: null,
      sourceUrl: "",
    });
  catalog.credits.push({
    id: randomUUID(),
    entityId: work.id,
    name: "Persona sintética",
    role: "Autor",
    scope: "authorship",
    share: 100,
    sourceUrl: "",
  });
  const db = openDatabase(":memory:");
  writeCatalog(db, catalog);
  assert.equal(readCatalog(db).credits.length, 4);
  catalog.credits[0].share = 10;
  assert.equal(catalogSchema.safeParse(catalog).success, false);
  catalog.credits[0].share = null;
  catalog.entities.push({
    ...work,
    id: randomUUID(),
    kind: "recording",
    sourceRecords: [{ Producer: '["https://notion.so/person"]' }],
  });
  const people = [
    { name: "Productor conocido", sourceUrl: "https://notion.so/person" },
  ];
  const enriched = enrichSourceCredits(catalog, people);
  assert.equal(enriched.added, 1);
  assert.equal(enrichSourceCredits(enriched.catalog, people).added, 0);
  assert.equal(enriched.catalog.credits.at(-1)!.share, null);
  db.close();
});

test("Office se lee como texto y valores sin activar enlaces, fórmulas ni macros", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "da-office-unit-"));
  const docx = await zipBuffer({
    "[Content_Types].xml":
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    "word/document.xml":
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Letra sintética &lt;script&gt;</w:t></w:r></w:p></w:body></w:document>',
    "_rels/.rels":
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  });
  const docxPath = path.join(directory, "test.docx");
  await writeFile(docxPath, docx);
  const word = (await officePreview(docxPath, "docx")) as { text: string };
  assert.match(word.text, /Letra sintética <script>/);
  const workbook = new ExcelJS.Workbook(),
    sheet = workbook.addWorksheet("Reparto");
  sheet.getCell("A1").value = "Nombre";
  sheet.getCell("B2").value = { formula: "50+50", result: 100 };
  const xlsxPath = path.join(directory, "test.xlsx");
  await workbook.xlsx.writeFile(xlsxPath);
  const excel = (await officePreview(xlsxPath, "xlsx")) as {
    sheets: { rows: { values: string[] }[] }[];
  };
  assert.equal(excel.sheets[0].rows[1].values[1], "100");
  const malicious = path.join(directory, "macro.docx");
  await writeFile(
    malicious,
    await zipBuffer({
      "word/document.xml": "hello",
      "word/vbaProject.bin": "macro",
    }),
  );
  assert.ok(
    ((await officePreview(malicious, "docx")) as { error: string }).error,
  );
});
