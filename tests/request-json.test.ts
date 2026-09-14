import test from "node:test";
import assert from "node:assert/strict";
import { boundedJson, RequestBodyError } from "../src/lib/request-json";
test("entrada JSON acotada conserva caracteres UTF-8", async () => {
  const request = new Request("https://example.test", {
    method: "POST",
    body: JSON.stringify({ title: "Bilingüe" }),
  });
  assert.deepEqual(await boundedJson(request, 100), { title: "Bilingüe" });
});
test("rechaza bytes excesivos aunque Content-Length no esté presente", async () => {
  const request = new Request("https://example.test", {
    method: "POST",
    body: JSON.stringify({ title: "x".repeat(100) }),
  });
  await assert.rejects(
    () => boundedJson(request, 30),
    (error: unknown) =>
      error instanceof RequestBodyError && error.status === 413,
  );
});
test("JSON corrupto produce error recuperable sin exponer contenido", async () => {
  const request = new Request("https://example.test", {
    method: "POST",
    body: "{incomplete",
  });
  await assert.rejects(
    () => boundedJson(request, 100),
    (error: unknown) =>
      error instanceof RequestBodyError && error.status === 400,
  );
});
