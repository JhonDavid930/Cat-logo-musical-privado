import { test, expect } from "@playwright/test";
import type { Catalog } from "../../src/lib/catalog";

test("búsqueda sin acentos, ficha unificada, registros y archivos", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Buscar en mi música" })
    .fill("bilingue");
  await expect(page.locator(".song-row")).toHaveCount(1);
  await page.locator(".song-row").click();
  await expect(
    page.getByRole("heading", { name: "BILINGUE", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Porcentaje sin confirmar", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Registros", exact: true }).click();
  await expect(page.locator(".registration")).toHaveCount(10);
  await page.locator(".registration").first().locator("summary").click();
  await expect(
    page
      .locator(".registration")
      .first()
      .getByRole("textbox", { name: "Notas" }),
  ).toHaveValue(/Las fichas de origen declaran estados distintos/);
  await page
    .getByRole("button", { name: /Archivos/ })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: "Añadir información o un enlace" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("edición persistente, evidencia explícita y exportación recuperable", async ({
  page,
  request,
}) => {
  const original = (await (
    await request.get("/api/catalog")
  ).json()) as Catalog;
  const title = "PRUEBA TEMPORAL DE VALIDACIÓN";
  try {
    await page.goto("/");
    await page
      .getByRole("button", { name: "Añadir una canción", exact: true })
      .click();
    await page.getByRole("textbox", { name: "Nombre de la ficha" }).fill(title);
    await page
      .getByRole("button", { name: "Crear ficha", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Editar ficha", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Texto de la letra" })
      .fill("Letra temporal para comprobar persistencia.");
    await page
      .getByRole("button", { name: "Guardar cambios", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("Cambios guardados");
    await page.reload();
    await expect(
      page.getByText("Letra temporal para comprobar persistencia.", {
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Registros", exact: true }).click();
    const first = page.locator(".registration").first();
    await first.locator("summary").click();
    await first.getByLabel("¿Este registro aplica?").selectOption("yes");
    await first.getByLabel("Estado declarado").selectOption("registered");
    await first
      .getByLabel("Enlace al justificante")
      .fill("https://example.com/test-only.pdf");
    await first.getByRole("checkbox").check();
    await first.getByRole("button", { name: "Guardar registro" }).click();
    await expect(
      page.locator(".registration").first().locator("summary"),
    ).toContainText("Evidencia revisada");
    await page
      .getByRole("button", { name: "Copias de seguridad", exact: true })
      .click();
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Descargar copia", exact: true })
      .click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/david-appleton.*json/);
    const fresh = (await (await request.get("/api/catalog")).json()) as Catalog;
    expect(
      fresh.entities.some(
        (e) => e.title === title && e.lyrics.includes("temporal"),
      ),
    ).toBe(true);
  } finally {
    const latest = (await (
      await request.get("/api/catalog")
    ).json()) as Catalog;
    const response = await request.put("/api/catalog", {
      headers: { origin: "http://127.0.0.1:3000" },
      data: { ...original, revision: latest.revision },
    });
    expect(response.ok()).toBe(true);
  }
});

test("rechaza guardado desde otro origen y revisiones antiguas", async ({
  request,
}) => {
  const original = await (await request.get("/api/catalog")).json();
  expect(
    (
      await request.put("/api/catalog", {
        headers: { origin: "https://untrusted.example" },
        data: original,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.put("/api/catalog", {
        headers: { origin: "http://127.0.0.1:3000" },
        data: { ...original, revision: Math.max(0, original.revision - 1) },
      })
    ).status(),
  ).toBe(409);
});

for (const width of [375, 768, 1024, 1440])
  test(`responsive ${width}px, navegación y temas`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(
      page.getByRole("textbox", { name: "Buscar en mi música" }),
    ).toBeInViewport();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `private/review-${width}-dark.png`,
      fullPage: false,
    });
    await page.getByRole("button", { name: "Modo claro", exact: true }).click();
    await expect(page.locator(".app")).toHaveClass(/light/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `private/review-${width}-light.png`,
      fullPage: false,
    });
    await page.getByRole("button", { name: /Mi música/ }).click();
    await expect(
      page.getByRole("heading", { name: "Mi música.", exact: true }),
    ).toBeVisible();
  });
