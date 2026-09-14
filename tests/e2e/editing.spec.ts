import { test, expect } from "@playwright/test";
import type { Catalog } from "../../src/lib/catalog";
test("autores, archivos y asociación manual persisten; restaura copia desde la interfaz", async ({
  page,
  request,
}) => {
  const original = (await (
    await request.get("/api/catalog")
  ).json()) as Catalog;
  const originalWork = original.entities.find((e) => e.kind === "work")!;
  try {
    await page.goto(`/?song=${originalWork.id}`);
    await page
      .getByRole("button", { name: "Editar ficha", exact: true })
      .click();
    const authors = page.locator("section.panel").filter({
      has: page.getByRole("heading", { name: "Autores y porcentajes" }),
    });
    const existingAuthor = authors.locator("form").first();
    await existingAuthor.getByLabel("Porcentaje", { exact: true }).fill("60");
    await existingAuthor.getByRole("button", { name: "Guardar autor" }).click();
    await expect(page.getByRole("status")).toContainText("Cambios guardados");
    const newAuthor = authors.locator("form").last();
    await newAuthor.getByLabel("Nuevo autor").fill("AUTOR TEMPORAL DE PRUEBA");
    await newAuthor.getByLabel("Porcentaje (si lo conoces)").fill("50");
    await newAuthor.getByRole("button", { name: "Añadir autor" }).click();
    await expect(page.getByRole("status")).toContainText("superar el 100");
    await newAuthor.getByLabel("Porcentaje (si lo conoces)").fill("40");
    await newAuthor.getByRole("button", { name: "Añadir autor" }).click();
    await expect(page.getByRole("status")).toContainText("Cambios guardados");
    await page.getByRole("button", { name: /^Archivos/ }).click();
    await page
      .getByRole("textbox", { name: "Nombre", exact: true })
      .fill("ARCHIVO TEMPORAL DE PRUEBA");
    await page
      .getByRole("combobox", { name: "Tipo", exact: true })
      .selectOption("certificate");
    await page
      .getByLabel("Enlace al archivo")
      .fill("https://example.com/test-only.pdf");
    await page.getByRole("button", { name: "Guardar información" }).click();
    await expect(
      page.getByRole("link", { name: "Abrir enlace externo" }),
    ).toHaveAttribute("href", "https://example.com/test-only.pdf");
    await page.reload();
    await page.getByRole("button", { name: /^Archivos/ }).click();
    await expect(
      page.getByRole("heading", { name: "ARCHIVO TEMPORAL DE PRUEBA" }),
    ).toBeVisible();
    const video = original.entities.find((e) => e.kind === "video")!;
    const recording = original.entities.find((e) => e.kind === "recording")!;
    await page.goto(`/?song=${video.id}`);
    await page.getByText("Vincular con otra ficha", { exact: true }).click();
    await page
      .getByLabel("Elegir ficha relacionada")
      .selectOption(recording.id);
    await page.getByRole("button", { name: "Vincular", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Cambios guardados");
    await page
      .getByRole("button", { name: "Copias de seguridad", exact: true })
      .click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByLabel("Seleccionar copia JSON").setInputFiles({
      name: "test-restore.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(original)),
    });
    await expect(page.getByRole("status")).toContainText("Cambios guardados");
    const restored = (await (
      await request.get("/api/catalog")
    ).json()) as Catalog;
    expect(restored.credits).toEqual(original.credits);
    expect(restored.documents).toEqual(original.documents);
    expect(restored.links).toEqual(original.links);
  } finally {
    const endpoint =
      (process.env.TEST_BASE_URL || "http://127.0.0.1:3000") + "/api/catalog";
    const latest = (await (await fetch(endpoint)).json()) as Catalog;
    const restored = await fetch(endpoint, {
      method: "PUT",
      headers: {
        origin: new URL(endpoint).origin,
        "content-type": "application/json",
      },
      body: JSON.stringify({ ...original, revision: latest.revision }),
    });
    expect(restored.ok).toBe(true);
  }
});
