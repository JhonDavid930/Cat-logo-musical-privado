import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { emptyCatalog, type Catalog, type Entity } from "../../src/lib/catalog";
const base = "http://127.0.0.1:3002";
test("álbum compartido, UPC con ceros, single adicional y sociedad PRO persistente", async ({
  page,
  request,
}) => {
  const login = await request.post("/api/auth", {
    headers: { origin: base },
    data: { password: "synthetic-files-test-password" },
  });
  const cookie = login.headers()["set-cookie"].split(";")[0];
  await page
    .context()
    .addCookies([
      {
        name: "da-session",
        value: cookie.split("=")[1],
        url: base,
        httpOnly: true,
        sameSite: "Strict",
      },
    ]);
  const current = await (
    await request.get("/api/catalog", { headers: { cookie } })
  ).json();
  const first: Entity = {
    id: randomUUID(),
    kind: "work",
    title: "Primera canción sintética",
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
  const second = {
    ...first,
    id: randomUUID(),
    title: "Segunda canción sintética",
  };
  const proId = randomUUID();
  const catalog: Catalog = {
    ...structuredClone(emptyCatalog),
    revision: current.revision,
    entities: [first, second],
    registrations: [
      {
        id: proId,
        entityId: first.id,
        agency: "PRO",
        status: "registered",
        applicable: "yes",
        evidenceUrl: "https://example.com/synthetic-certificate",
        verifiedAt: "2026-09-10T00:00:00.000Z",
        notes: "Nota original",
        sourceValues: ["Registered"],
      },
    ],
  };
  expect(
    (
      await request.put("/api/catalog", {
        headers: { cookie, origin: base },
        data: catalog,
      })
    ).status(),
  ).toBe(200);
  await page.goto(`/?song=${first.id}`);
  await page
    .getByRole("button", { name: "Añadir lanzamiento y UPC", exact: true })
    .click();
  const create = page.locator(".release-create");
  await create
    .getByLabel("Nombre del lanzamiento")
    .fill("Álbum compartido de prueba");
  await create
    .getByRole("combobox", { name: "Tipo de lanzamiento", exact: true })
    .selectOption("album");
  await create.getByLabel("Distribuidora").fill("Amuse");
  await create
    .getByRole("textbox", { name: "UPC / EAN del lanzamiento", exact: true })
    .fill("036000291452");
  await create
    .getByRole("button", { name: "Crear lanzamiento asociado" })
    .click();
  await expect(page.locator(".release-entry")).toHaveCount(1);
  const saved = (await (
    await request.get("/api/catalog", { headers: { cookie } })
  ).json()) as Catalog;
  const album = saved.entities.find((entity) => entity.kind === "release")!;
  await page.goto(`/?song=${second.id}`);
  await page
    .getByText("Asociar un lanzamiento que ya existe", { exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Lanzamiento existente", exact: true })
    .selectOption(album.id);
  await page
    .getByRole("button", { name: "Asociar lanzamiento", exact: true })
    .click();
  await expect(page.locator(".release-entry")).toHaveCount(1);
  await page
    .locator(".release-entry")
    .getByRole("textbox", { name: "UPC / EAN del lanzamiento", exact: true })
    .fill("0036000291452");
  await page
    .getByRole("button", { name: "Guardar lanzamiento", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Cambios guardados");
  await page.goto(`/?song=${first.id}`);
  await expect(page.locator(".release-entry input[name=upc]")).toHaveValue(
    "0036000291452",
  );
  await expect(
    page.locator(".release-entry select[name=releaseType]"),
  ).toHaveValue("album");
  await expect(
    page.locator(".release-entry input[name=distributor]"),
  ).toHaveValue("Amuse");
  await page
    .getByRole("button", { name: "Añadir lanzamiento y UPC", exact: true })
    .click();
  await page
    .locator(".release-create")
    .getByLabel("Nombre del lanzamiento")
    .fill("Single de prueba");
  await page
    .locator(".release-create")
    .getByRole("combobox", { name: "Tipo de lanzamiento", exact: true })
    .selectOption("single");
  await page
    .locator(".release-create")
    .getByRole("button", { name: "Crear lanzamiento asociado" })
    .click();
  await expect(page.locator(".release-entry")).toHaveCount(2);
  await page
    .locator(".release-entry")
    .last()
    .getByRole("textbox", { name: "UPC / EAN del lanzamiento", exact: true })
    .fill("123");
  await page
    .locator(".release-entry")
    .last()
    .getByRole("button", { name: "Guardar lanzamiento", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("12 dígitos");
  await page.reload();
  await expect(
    page.locator(".release-entry").last().locator("input[name=upc]"),
  ).toHaveValue("");
  await page.setViewportSize({ width: 375, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .locator(".release-panel")
    .screenshot({ path: "private/upc-mobile.png" });
  const audit = await new AxeBuilder({ page })
    .include(".app")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
  await page.getByRole("button", { name: "Registros", exact: true }).click();
  const registration = page.locator(".registration").first();
  await expect(registration.locator("summary")).toContainText(
    "PRO · Sin especificar",
  );
  await registration.locator("summary").click();
  await registration
    .getByRole("combobox", { name: "Sociedad concreta", exact: true })
    .selectOption("BMI");
  await registration
    .getByRole("button", { name: "Guardar registro", exact: true })
    .click();
  await expect(registration.locator("summary")).toContainText("PRO · BMI");
  const after = (await (
    await request.get("/api/catalog", { headers: { cookie } })
  ).json()) as Catalog;
  expect(after.registrations).toHaveLength(1);
  expect(after.registrations[0]).toMatchObject({
    id: proId,
    organization: "BMI",
    status: "registered",
    evidenceUrl: catalog.registrations[0].evidenceUrl,
    verifiedAt: catalog.registrations[0].verifiedAt,
    notes: "Nota original",
  });
  await registration.locator("summary").click();
  await registration.getByRole("combobox", { name: "Sociedad concreta", exact: true }).selectOption("__other__");
  await expect(page.getByText("Cambios guardados.", {exact:true})).toHaveCount(0);
  await registration.getByRole("button", {name:"Guardar registro",exact:true}).click();
  const emptyName=registration.locator('input[name="organization"]');
  expect(await emptyName.evaluate((input:HTMLInputElement)=>input.validationMessage)).toContain("Escribe el nombre");
  expect((await (await request.get("/api/catalog",{headers:{cookie}})).json()).registrations[0].organization).toBe("BMI");
  await emptyName.fill("   ");
  await registration.getByRole("button", {name:"Guardar registro",exact:true}).click();
  expect(await emptyName.evaluate((input:HTMLInputElement)=>input.checkValidity())).toBe(false);
  await registration.getByRole("combobox", { name: "Sociedad concreta", exact: true }).selectOption("BMI");
  expect(
    after.entities.filter((entity) => entity.kind === "release"),
  ).toHaveLength(2);
  expect(after.links.filter((link) => link.fromId === album.id)).toHaveLength(
    2,
  );
  await page
    .getByText("Añadir otra entidad de registro", { exact: true })
    .click();
  const add = page
    .locator("details.panel")
    .filter({
      has: page.getByText("Añadir otra entidad de registro", { exact: true }),
    });
  await add
    .getByRole("combobox", { name: "Sociedad concreta", exact: true })
    .selectOption("ASCAP");
  await add
    .getByRole("button", { name: "Añadir entidad", exact: true })
    .click();
  await expect(page.locator(".registration")).toHaveCount(2);
  await page.reload();
  await page.getByRole("button", { name: "Registros", exact: true }).click();
  await expect(
    page.locator(".registration").last().locator("summary"),
  ).toContainText("PRO · ASCAP");
  await page.locator(".registration").last().locator("summary").click();
  await page
    .locator(".registration")
    .last()
    .getByRole("combobox", { name: "Sociedad concreta", exact: true })
    .selectOption("__other__");
  await page.getByLabel("Nombre de la sociedad").fill("Entidad de prueba");
  await page
    .locator(".registration")
    .last()
    .getByRole("button", { name: "Guardar registro", exact: true })
    .click();
  await expect(
    page.locator(".registration").last().locator("summary"),
  ).toContainText("PRO · Entidad de prueba");
  await page.goto(`/?song=${second.id}`);
  await page.getByRole("button",{name:"Registros",exact:true}).click();
  await page.getByText("Añadir otra entidad de registro",{exact:true}).click();
  await add.getByRole("combobox",{name:"Sociedad concreta",exact:true}).selectOption("Entidad de prueba");
  await add.getByRole("button",{name:"Añadir entidad",exact:true}).click();
  await expect(page.locator(".registration summary")).toContainText("PRO · Entidad de prueba");
  await page.reload();
  await page.getByRole("button",{name:"Registros",exact:true}).click();
  await page.locator(".registration summary").click();
  await expect(page.locator(".registration").getByRole("combobox",{name:"Sociedad concreta",exact:true})).toHaveValue("Entidad de prueba");
  await page
    .locator(".detail")
    .screenshot({ path: "private/pro-organizations-mobile.png" });
  await page.getByRole("button", { name: /Mi espacio/ }).click();
  await expect(
    page.locator(".agency-card").filter({ hasText: "PRO · BMI" }),
  ).toHaveCount(1);
});
