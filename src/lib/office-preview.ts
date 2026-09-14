import { execFile } from "node:child_process";
import path from "node:path";
import mammoth from "mammoth";
import ExcelJS from "exceljs";

let active = 0;

export async function officePreview(
  filename: string,
  kind: "docx" | "xlsx",
): Promise<unknown> {
  if (active >= 2)
    return {
      error:
        "Hay otras lecturas en curso. Cierra y vuelve a abrir esta vista en unos segundos.",
    };
  if (!mammoth.extractRawText || !ExcelJS.Workbook)
    return { error: "Lector no disponible. Descarga el original." };
  active++;
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [
        "--max-old-space-size=256",
        path.join(process.cwd(), "scripts", "preview-document.cjs"),
        filename,
        kind,
      ],
      {
        timeout: 12000,
        maxBuffer: 8 * 1024 * 1024,
        windowsHide: true,
        env: {
          PATH: process.env.PATH,
          SystemRoot: process.env.SystemRoot,
          NODE_ENV: "production",
        },
      },
      (error, stdout) => {
        active--;
        if (error) {
          resolve({
            error:
              "Vista previa no disponible para este documento. Puedes descargar el original.",
          });
          return;
        }
        try {
          resolve(JSON.parse(stdout));
        } catch {
          resolve({
            error: "Vista previa no disponible. Descarga el original.",
          });
        }
      },
    );
  });
}
