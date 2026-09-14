export class RequestBodyError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function boundedJson(
  request: Request,
  maximumBytes: number,
): Promise<unknown> {
  if (Number(request.headers.get("content-length") || 0) > maximumBytes)
    throw new RequestBodyError("El archivo supera el tamaño permitido.", 413);
  const reader = request.body?.getReader();
  if (!reader)
    throw new RequestBodyError("Faltan los datos de la petición.", 400);
  const decoder = new TextDecoder();
  let content = "",
    size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximumBytes) {
        await reader.cancel();
        throw new RequestBodyError(
          "El archivo supera el tamaño permitido.",
          413,
        );
      }
      content += decoder.decode(value, { stream: true });
    }
    content += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(content);
  } catch {
    throw new RequestBodyError("El archivo no contiene JSON válido.", 400);
  }
}
