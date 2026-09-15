import { cookies } from "next/headers";
import { z } from "zod";
import { boundedJson, RequestBodyError } from "@/lib/request-json";
import {
  cookieName,
  isConfigured,
  sameOrigin,
  sessionToken,
  validPassword,
} from "@/lib/auth";
const attempts = { count: 0, window: 0 };
export async function POST(request: Request) {
  if (!isConfigured())
    return Response.json(
      { error: "El acceso privado todavía no está configurado." },
      { status: 403 },
    );
  if (!sameOrigin(request))
    return Response.json(
      {
        error:
          "Esta dirección no está autorizada para iniciar sesión. Abre la dirección local del catálogo.",
      },
      { status: 403 },
    );
  if (Date.now() - attempts.window > 60_000) {
    attempts.count = 0;
    attempts.window = Date.now();
  }
  if (++attempts.count > 10)
    return Response.json(
      { error: "Espera un minuto antes de volver a intentarlo." },
      { status: 429 },
    );
  let body: unknown;
  try {
    body = await boundedJson(request, 4096);
  } catch (error) {
    return Response.json(
      { error: "Petición de acceso no válida." },
      { status: error instanceof RequestBodyError ? error.status : 400 },
    );
  }
  const input = z
    .object({ password: z.string().min(1).max(256) })
    .safeParse(body);
  if (!input.success || !validPassword(input.data.password))
    return Response.json(
      { error: "La contraseña no es correcta." },
      { status: 401 },
    );
  (await cookies()).set(cookieName, sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  return Response.json({ ok: true });
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Origen no autorizado." }, { status: 403 });
  (await cookies()).delete(cookieName);
  return Response.json({ ok: true });
}
