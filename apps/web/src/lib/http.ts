import "server-only";
import { ApiFault } from "./security";
export async function readBody(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new ApiFault(415, "content_type", "Use application/json");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiFault(400, "invalid_body", "JSON body required");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 64000) {
      await reader.cancel();
      throw new ApiFault(413, "body_too_large", "Body exceeds 64KB");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new ApiFault(400, "invalid_json", "Invalid JSON");
  }
}
