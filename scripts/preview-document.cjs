const fs = require("node:fs/promises");
const yauzl = require("yauzl");
const mammoth = require("mammoth");
const ExcelJS = require("exceljs");

async function validateArchive(buffer, kind) {
  await new Promise((resolve, reject) => {
    yauzl.fromBuffer(
      buffer,
      { lazyEntries: true, validateEntrySizes: true, strictFileNames: true },
      (error, zip) => {
        if (error) return reject(error);
        let count = 0,
          total = 0,
          hasDocument = false;
        const fail = (error) => {
          zip.close();
          reject(error);
        };
        zip.on("error", fail);
        zip.on("end", () =>
          hasDocument
            ? resolve()
            : reject(new Error("Contenido Office no válido")),
        );
        zip.on("entry", (entry) => {
          total += entry.uncompressedSize;
          if (
            ++count > 2000 ||
            total > 40 * 1024 * 1024 ||
            entry.uncompressedSize > 20 * 1024 * 1024 ||
            entry.isEncrypted() ||
            /vbaproject|activex|embeddings|externallinks/i.test(entry.fileName)
          )
            return fail(
              new Error(
                "Documento complejo o con contenido activo: usa la descarga original",
              ),
            );
          if (
            entry.fileName ===
            (kind === "docx" ? "word/document.xml" : "xl/workbook.xml")
          )
            hasDocument = true;
          if (entry.fileName.endsWith("/")) {
            zip.readEntry();
            return;
          }
          zip.openReadStream(entry, (error, stream) => {
            if (error) return fail(error);
            stream.on("error", fail);
            stream.on("end", () => zip.readEntry());
            stream.resume();
          });
        });
        zip.readEntry();
      },
    );
  });
}

async function main() {
  const [filename, kind] = process.argv.slice(2);
  const stat = await fs.stat(filename);
  if (stat.size > 20 * 1024 * 1024)
    throw new Error("Vista previa limitada a documentos de 20 MiB");
  const buffer = await fs.readFile(filename);
  await validateArchive(buffer, kind);
  if (kind === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return {
      text: result.value.slice(0, 200000),
      truncated: result.value.length > 200000,
      note: "Lectura de texto; el diseño original se conserva en la descarga.",
    };
  }
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer, {
    ignoreNodes: [
      "dataValidations",
      "conditionalFormatting",
      "hyperlinks",
      "drawing",
      "picture",
      "extLst",
    ],
  });
  const sheets = workbook.worksheets.slice(0, 10).map((sheet) => {
    const rows = [];
    sheet.eachRow((row, number) => {
      if (rows.length >= 200) return;
      const values = [];
      for (let index = 1; index <= Math.min(sheet.columnCount, 30); index++) {
        const cell = row.getCell(index);
        values.push(
          (cell.formula && cell.result == null
            ? "[Fórmula sin resultado guardado]"
            : cell.text
          ).slice(0, 1000),
        );
      }
      rows.push({ number, values });
    });
    return { name: sheet.name, rows };
  });
  return {
    sheets,
    note: "Hasta 10 hojas, 200 filas y 30 columnas por hoja. Se muestran valores guardados; no se calculan fórmulas ni se siguen enlaces.",
  };
}
main()
  .then((result) => process.stdout.write(JSON.stringify(result)))
  .catch(() => {
    process.stdout.write(
      JSON.stringify({
        error:
          "No se puede previsualizar este documento con seguridad. Descarga el original para abrirlo en tu aplicación.",
      }),
    );
    process.exitCode = 1;
  });
