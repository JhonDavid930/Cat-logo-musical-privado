import { test, expect } from "@playwright/test";
import { progress, type Catalog } from "../../src/lib/catalog";
import { registrationLabel } from "../../src/lib/registration-label";
test("barras fieles a datos, desconocidos sin relleno y movimiento reducido", async ({
  page,
  request,
}) => {
  const catalog = (await (await request.get("/api/catalog")).json()) as Catalog;
  const general = progress(catalog.registrations);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const overall = page.getByRole("progressbar", {
    name: "Avance general de registros declarados",
    exact: true,
  });
  await expect(overall).toHaveAttribute(
    "aria-valuenow",
    String(general.declaredPercent),
  );
  const verified = page.getByRole("progressbar", {
    name: "Avance general con evidencia revisada",
    exact: true,
  });
  await expect(verified).toHaveAttribute(
    "aria-valuenow",
    String(general.verifiedPercent),
  );
  for (const agency of [
    ...new Set(catalog.registrations.map(registrationLabel)),
  ]) {
    const summary = progress(
      catalog.registrations.filter((r) => registrationLabel(r) === agency),
    );
    if (summary.declaredPercent === null) {
      const unknown = page.getByRole("img", {
        name: `${agency}: registros declarados: sin registros aplicables confirmados`,
        exact: true,
      });
      await expect(unknown).toBeAttached();
      await expect(unknown.locator(".meter-fill")).toHaveCSS(
        "transform",
        "matrix(0, 0, 0, 1, 0, 0)",
      );
    } else
      await expect(
        page.getByRole("progressbar", {
          name: `${agency}: registros declarados`,
          exact: true,
        }),
      ).toHaveAttribute("aria-valuenow", String(summary.declaredPercent));
  }
  await expect(overall.locator(".meter-fill")).toHaveCSS(
    "transition-duration",
    "0s",
  );
  await page.screenshot({
    path: "private/progress-overview-dark.png",
    animations: "disabled",
  });
  await page.locator(".agency-section").screenshot({
    path: "private/progress-agencies-dark.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Modo claro", exact: true }).click();
  await page.locator(".agency-section").screenshot({
    path: "private/progress-agencies-light.png",
    animations: "disabled",
  });
  await page.setViewportSize({ width: 375, height: 900 });
  await page.getByRole("button", { name: "Modo oscuro", exact: true }).click();
  await page.locator(".agency-section").screenshot({
    path: "private/progress-agencies-mobile.png",
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
