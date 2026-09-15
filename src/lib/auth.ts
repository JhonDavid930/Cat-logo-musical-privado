import "server-only";
import { createHmac, timingSafeEqual, scryptSync } from "node:crypto";
import { cookies, headers } from "next/headers";

export const cookieName = "da-session";
export function isConfigured() {
  return Boolean(
    process.env.CATALOG_PASSWORD_HASH &&
    process.env.CATALOG_SESSION_SECRET &&
    process.env.CATALOG_SESSION_SECRET.length >= 32,
  );
}
export function isLocalPreview() {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.CATALOG_LOCAL_PREVIEW === "true"
  );
}
export async function authorized() {
  if (isLocalPreview()) {
    const host = (await headers()).get("host") ?? "";
    return /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  }
  if (!isConfigured()) return false;
  const value = (await cookies()).get(cookieName)?.value ?? "";
  const [expires, signature] = value.split(".");
  if (
    !expires ||
    !signature ||
    Number(expires) < Date.now() ||
    Number(expires) > Date.now() + 8 * 60 * 60 * 1000
  )
    return false;
  const expected = createHmac("sha256", process.env.CATALOG_SESSION_SECRET!)
    .update(expires)
    .digest("hex");
  return (
    signature.length === expected.length &&
    timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  );
}
export function validPassword(password: string) {
  const [salt, stored] = (process.env.CATALOG_PASSWORD_HASH ?? "").split(":");
  if (!salt || !stored) return false;
  const candidate = scryptSync(password, salt, 64).toString("hex");
  return (
    candidate.length === stored.length &&
    timingSafeEqual(Buffer.from(candidate), Buffer.from(stored))
  );
}
export function sessionToken() {
  const expires = String(Date.now() + 8 * 60 * 60 * 1000);
  return (
    expires +
    "." +
    createHmac("sha256", process.env.CATALOG_SESSION_SECRET!)
      .update(expires)
      .digest("hex")
  );
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") ?? "";
  const localOrigin =
    isLocalPreview() && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)
      ? `http://${host}`
      : "";
  const expected = process.env.CATALOG_APP_URL || localOrigin;
  if (!expected || !origin) return false;
  if (origin === expected) return true;

  const localAddress = /^http:\/\/(127\.0\.0\.1|localhost):(\d+)$/.exec(
    expected,
  );
  if (!localAddress) return false;
  const alternateHost =
    localAddress[1] === "localhost" ? "127.0.0.1" : "localhost";
  return (
    host === `${alternateHost}:${localAddress[2]}` &&
    origin === `http://${host}`
  );
}
