import { expect, test } from "@playwright/test";

test("localhost abre el mismo archivo privado sin debilitar el control de Origin", async ({
  page,
  request,
}) => {
  await page.goto("http://localhost:3002/");
  await expect(
    page.getByRole("heading", { name: "Un espacio para tu música." }),
  ).toBeVisible();
  await page.getByLabel("Contraseña").fill("synthetic-files-test-password");
  await page.getByRole("button", { name: "Entrar en mi archivo" }).click();
  await expect(page.getByText("Mi espacio", { exact: true })).toBeVisible();

  const rejected = await request.post("http://127.0.0.1:3002/api/auth", {
    headers: { origin: "https://other.example" },
    data: { password: "synthetic-files-test-password" },
  });
  expect(rejected.status()).toBe(403);
  expect((await rejected.json()).error).toContain(
    "dirección no está autorizada",
  );
});
