import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
for (const theme of ["dark", "light"])
  test(`accesibilidad automática ${theme}`, async ({ page }) => {
    await page.goto("/");
    if (theme === "light")
      await page
        .getByRole("button", { name: "Modo claro", exact: true })
        .click();
    await page
      .locator(".app")
      .evaluate((element) =>
        Promise.all(
          element.getAnimations({ subtree: true }).map((a) => a.finished),
        ),
      );
    const result = await new AxeBuilder({ page })
      .include(".app")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  });
