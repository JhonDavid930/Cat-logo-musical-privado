import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { ZipFile } from "yazl";
import ExcelJS from "exceljs";
import AxeBuilder from "@axe-core/playwright";
import { emptyCatalog, type Catalog, type Entity } from "../../src/lib/catalog";
const base = "http://127.0.0.1:3002";
const entity: Entity = {
  id: randomUUID(),
  kind: "work",
  title: "Canción de prueba privada",
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
const recording: Entity = {
  ...entity,
  id: randomUUID(),
  title: "Versión de prueba",
  kind: "recording",
  genre: "Afrobeat",
};
let cookie: string;
function syntheticPdf() {
  const stream = "BT /F1 14 Tf 40 100 Td (PDF de prueba) Tj ET";
  const objects = [
    "<</Type /Catalog /Pages 2 0 R>>",
    "<</Type /Pages /Kids [3 0 R] /Count 1>>",
    "<</Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources <</Font <</F1 4 0 R>>>> /Contents 5 0 R>>",
    "<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>",
    `<</Length ${stream.length}>>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const offset = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((value) => String(value).padStart(10, "0") + " 00000 n ")
    .join(
      "\n",
    )}\ntrailer\n<</Size 6 /Root 1 0 R>>\nstartxref\n${offset}\n%%EOF`;
  return Buffer.from(pdf);
}
test.beforeEach(async ({ page, request }) => {
  const login = await request.post("/api/auth", {
    headers: { origin: base },
    data: { password: "synthetic-files-test-password" },
  });
  expect(login.status()).toBe(200);
  cookie = login.headers()["set-cookie"].split(";")[0];
  await page.context().addCookies([
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
  const catalog: Catalog = {
    ...structuredClone(emptyCatalog),
    revision: current.revision,
    entities: [entity, recording],
    links: [
      {
        id: randomUUID(),
        fromId: recording.id,
        toId: entity.id,
        relation: "recording_work",
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
});

test("subida múltiple, lectura, reproducción, protección, ZIP y recuperación", async ({
  page,
  request,
}) => {
  await page.goto(`/?song=${entity.id}`);
  await page.getByRole("button", { name: /^Archivos/ }).click();
  const wav = Buffer.alloc(16044);
  wav.write("RIFF");
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(16000, 40);
  await page.getByLabel("O selecciona varios archivos").setInputFiles([
    {
      name: "letra.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Letra original sintética <script>alert(1)</script>"),
    },
    { name: "master.wav", mimeType: "audio/wav", buffer: wav },
    {
      name: "certificado.pdf",
      mimeType: "application/pdf",
      buffer: syntheticPdf(),
    },
  ]);
  await page
    .getByRole("button", { name: "Subir archivos", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("3 archivos guardados.");
  const textCard = page.locator(".file-card").filter({
    has: page.getByRole("heading", { name: "letra.txt", exact: true }),
  });
  await textCard.getByRole("button", { name: "Leer aquí" }).click();
  await expect(textCard.locator("pre")).toContainText(
    "<script>alert(1)</script>",
  );
  const audioCard = page.locator(".file-card").filter({
    has: page.getByRole("heading", { name: "master.wav", exact: true }),
  });
  await audioCard.getByRole("button", { name: "Reproducir" }).click();
  await expect
    .poll(() =>
      audioCard
        .locator("audio")
        .evaluate((audio) => (audio as HTMLAudioElement).readyState),
    )
    .toBeGreaterThan(0);
  await audioCard
    .locator("audio")
    .evaluate((audio) => (audio as HTMLAudioElement).play());
  await expect
    .poll(() =>
      audioCard
        .locator("audio")
        .evaluate((audio) => (audio as HTMLAudioElement).currentTime),
    )
    .toBeGreaterThan(0);
  const snapshot = (await (
    await request.get("/api/catalog", { headers: { cookie } })
  ).json()) as Catalog;
  const pdfCard = page.locator(".file-card").filter({
    has: page.getByRole("heading", { name: "certificado.pdf", exact: true }),
  });
  await pdfCard.getByRole("button", { name: "Leer aquí" }).click();
  await expect(pdfCard.locator("iframe")).toBeVisible();
  const pdfResponse = await request.get(
    `/api/documents/${snapshot.documents.find((document) => document.name === "certificado.pdf")!.id}?mode=preview`,
    { headers: { cookie } },
  );
  expect(pdfResponse.headers()["content-type"]).toBe("application/pdf");
  expect(pdfResponse.headers()["x-frame-options"]).toBe("SAMEORIGIN");
  expect(snapshot.documents).toHaveLength(3);
  expect(
    snapshot.documents.every((document) => document.kind === "certificate"),
  ).toBe(true);
  const audioId = snapshot.documents.find(
    (document) => document.name === "master.wav",
  )!.id;
  const range = await request.get(`/api/documents/${audioId}?mode=preview`, {
    headers: { cookie, range: "bytes=0-11" },
  });
  expect(range.status()).toBe(206);
  expect(await range.body()).toEqual(wav.subarray(0, 12));
  const anonymous = await fetch(`${base}/api/documents/${audioId}`);
  expect(anonymous.status).toBe(401);
  expect(
    (
      await request.post("/api/documents/upload?filename=x.txt", {
        headers: { cookie, origin: "https://foreign.test" },
        data: "x",
      })
    ).status(),
  ).toBe(403);
  const forged = structuredClone(snapshot);
  forged.documents[0].file!.mediaType = "application/pdf";
  expect(
    (
      await request.put("/api/catalog", {
        headers: { cookie, origin: base },
        data: forged,
      })
    ).status(),
  ).toBe(400);
  await page
    .getByLabel("Nombre", { exact: true })
    .fill("Información sin adjunto");
  await page.getByLabel("Nota opcional").fill("Datos escritos conservados");
  await page.getByRole("button", { name: "Guardar información" }).click();
  await expect(page.getByText("Datos escritos conservados")).toBeVisible();
  const zip = await request.get("/api/backup", { headers: { cookie } });
  expect(zip.status()).toBe(200);
  const archive = await zip.body();
  const current = await (
    await request.get("/api/catalog", { headers: { cookie } })
  ).json();
  current.documents = [];
  expect(
    (
      await request.put("/api/catalog", {
        headers: { cookie, origin: base },
        data: current,
      })
    ).ok(),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Copias de seguridad", exact: true })
    .click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Recuperar copia completa ZIP").setInputFiles({
    name: "complete.zip",
    mimeType: "application/zip",
    buffer: archive,
  });
  await expect(
    page.getByText(
      "Copia completa recuperada. Se han comprobado los archivos.",
    ),
  ).toBeVisible();
  const after = await (
    await request.get("/api/catalog", { headers: { cookie } })
  ).json();
  expect(after.documents).toHaveLength(4);
  expect(
    await (
      await request.get(`/api/documents/${audioId}`, { headers: { cookie } })
    ).body(),
  ).toEqual(wav);
  await page.goto(`/?song=${entity.id}`);
  await page.getByRole("button", { name: /^Archivos/ }).click();
  await expect(
    page.getByRole("heading", { name: "Información sin adjunto" }),
  ).toBeVisible();
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({ path: "private/files-desktop.png", fullPage: true });
  await page
    .locator(".app")
    .evaluate((element) =>
      Promise.all(
        element
          .getAnimations({ subtree: true })
          .map((animation) => animation.finished),
      ),
    );
  const accessibility = await new AxeBuilder({ page })
    .include(".app")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

test("vídeo por drag and drop, biblioteca global y género al crear", async ({
  page,
  request,
}) => {
  await page.goto(`/?song=${entity.id}`);
  await page.getByRole("button", { name: /^Archivos/ }).click();
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 90;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#dbac96";
    context.fillRect(0, 0, 160, 90);
    const stream = canvas.captureStream(10),
      recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    const recorded = new Promise<number[]>((resolve) => {
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        resolve(
          Array.from(
            new Uint8Array(
              await new Blob(chunks, { type: "video/webm" }).arrayBuffer(),
            ),
          ),
        );
      };
    });
    recorder.start();
    let frame = 0;
    const timer = setInterval(() => {
      context.fillStyle = frame++ % 2 ? "#dbac96" : "#151b1b";
      context.fillRect(0, 0, 160, 90);
    }, 100);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    clearInterval(timer);
    recorder.stop();
    return recorded;
  });
  await page
    .getByRole("combobox", { name: "Guardar archivos como" })
    .selectOption("video");
  const transfer = await page.evaluateHandle((bytes) => {
    const transfer = new DataTransfer();
    transfer.items.add(
      new File([new Uint8Array(bytes)], "clip.webm", { type: "video/webm" }),
    );
    return transfer;
  }, bytes);
  await page
    .locator(".drop-zone")
    .dispatchEvent("drop", { dataTransfer: transfer });
  await transfer.dispose();
  await page
    .getByRole("button", { name: "Subir archivos", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("1 archivo guardado.");
  await page.getByRole("button", { name: "Reproducir", exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator("video")
        .evaluate((video) => (video as HTMLVideoElement).readyState),
    )
    .toBeGreaterThan(0);
  await page
    .locator("video")
    .evaluate((video) => (video as HTMLVideoElement).play());
  await expect
    .poll(() =>
      page
        .locator("video")
        .evaluate((video) => (video as HTMLVideoElement).currentTime),
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: /Mis archivos/ }).click();
  await expect(
    page.getByRole("heading", { name: "clip.webm", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Mi música/ }).click();
  await page.getByRole("button", { name: "Nueva ficha", exact: true }).click();
  await page.getByLabel("Nombre de la ficha").fill("Nueva canción sintética");
  await page
    .getByRole("combobox", { name: "Género", exact: true })
    .selectOption("Afropop");
  await page.getByRole("button", { name: "Crear ficha", exact: true }).click();
  await expect(page.locator(".detail-meta")).toContainText("Afropop");
  await page.getByRole("button", { name: "Editar ficha", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Género", exact: true })
    .selectOption("__custom__");
  await page
    .getByRole("textbox", { name: "Otro género", exact: true })
    .fill("Género personal");
  await page
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await page.reload();
  await expect(page.locator(".detail-meta")).toContainText("Género personal");
  await page.getByRole("button", { name: /^Archivos/ }).click();
  await expect(page.getByLabel("O selecciona varios archivos")).toBeVisible();
  await page.getByRole("button", { name: "Modo claro", exact: true }).click();
  await page
    .locator(".app")
    .evaluate((element) =>
      Promise.all(
        element
          .getAnimations({ subtree: true })
          .map((animation) => animation.finished),
      ),
    );
  const accessibility = await new AxeBuilder({ page })
    .include(".app")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.setViewportSize({ width: 375, height: 900 });
  await page.screenshot({
    path: "private/files-mobile-light.png",
    fullPage: true,
  });
});

test("lector Word/Excel en producción, selector completo y varios roles", async ({
  page,
  request,
}) => {
  const zip = new ZipFile();
  zip.addBuffer(
    Buffer.from(
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Letra de prueba Word</w:t></w:r></w:p></w:body></w:document>',
    ),
    "word/document.xml",
  );
  zip.addBuffer(
    Buffer.from(
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    ),
    "_rels/.rels",
  );
  zip.end();
  const chunks: Buffer[] = [];
  for await (const chunk of zip.outputStream as import("node:stream").Readable)
    chunks.push(Buffer.from(chunk));
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("Créditos").addRow(["Persona sintética", "Productor"]);
  for (const [name, buffer] of [
    ["letra.docx", Buffer.concat(chunks)],
    ["creditos.xlsx", Buffer.from(await workbook.xlsx.writeBuffer())],
  ] as const) {
    const params = new URLSearchParams({
      entityId: entity.id,
      kind: "other",
      filename: name,
      name,
    });
    const response = await request.post(`/api/documents/upload?${params}`, {
      headers: {
        cookie,
        origin: base,
        "Content-Type": "application/octet-stream",
      },
      data: buffer,
    });
    expect(response.status()).toBe(200);
  }
  await page.goto(`/?song=${entity.id}`);
  await expect(page.locator(".detail-meta")).toContainText("Afrobeat");
  await page.getByRole("button", { name: /^Archivos/ }).click();
  const wordCard = page.locator(".file-card").filter({
    has: page.getByRole("heading", { name: "letra.docx", exact: true }),
  });
  await wordCard.getByRole("button", { name: "Leer aquí" }).click();
  await expect(wordCard.locator("pre")).toContainText("Letra de prueba Word");
  const excelCard = page.locator(".file-card").filter({
    has: page.getByRole("heading", { name: "creditos.xlsx", exact: true }),
  });
  await excelCard.getByRole("button", { name: "Leer aquí" }).click();
  await expect(excelCard.locator("table")).toContainText("Persona sintética");
  await page.getByRole("button", { name: "Editar ficha", exact: true }).click();
  await expect(
    page
      .getByRole("combobox", { name: "Género", exact: true })
      .locator("option"),
  ).toHaveCount(39);
  await page.getByLabel("Buscar género").fill("Reggaeton");
  await page
    .getByRole("combobox", { name: "Género", exact: true })
    .selectOption("Reggaeton");
  await page
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await page.getByRole("button", { name: "Créditos", exact: true }).click();
  const form = page.locator(".credit-form").last();
  await form.getByLabel("Nombre de la persona").fill("Persona prueba");
  await form
    .getByRole("combobox", { name: "Rol", exact: true })
    .selectOption("Productor");
  await form
    .getByRole("combobox", { name: "Participa en", exact: true })
    .selectOption(recording.id);
  await form.getByRole("button", { name: "Añadir crédito" }).click();
  await expect(page.locator(".credit-form")).toHaveCount(2);
  const next = page.locator(".credit-form").last();
  await next
    .getByRole("combobox", { name: "Persona", exact: true })
    .selectOption("Persona prueba");
  await next
    .getByRole("combobox", { name: "Rol", exact: true })
    .selectOption("Mastering");
  await next
    .getByRole("combobox", { name: "Participa en", exact: true })
    .selectOption(recording.id);
  await next.getByRole("button", { name: "Añadir crédito" }).click();
  await expect(page.locator(".credit-form")).toHaveCount(3);
  await page.reload();
  await page.getByRole("button", { name: "Créditos", exact: true }).click();
  await expect(page.locator(".credit-form")).toHaveCount(3);
  const result = await (
    await request.get("/api/catalog", { headers: { cookie } })
  ).json();
  expect(
    result.credits.every(
      (credit: { scope: string; share: number | null; entityId: string }) =>
        credit.scope === "professional" &&
        credit.share === null &&
        credit.entityId === recording.id,
    ),
  ).toBe(true);
  expect(
    result.entities.find((item: Entity) => item.id === entity.id).genre,
  ).toBe("Reggaeton");
  expect(
    result.entities.find((item: Entity) => item.id === recording.id).genre,
  ).toBe("Afrobeat");
  await page.setViewportSize({ width: 375, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "private/credits-mobile.png", fullPage: true });
});
