import "server-only";
import {
  createHash,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
export class ApiFault extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const secret = () => randomBytes(32).toString("base64url");
export function required(name: string) {
  const value = process.env[name];
  if (!value)
    throw new ApiFault(
      503,
      "configuration_missing",
      `${name} is not configured`,
    );
  return value;
}
export function appOrigin() {
  return new URL(required("NEXT_PUBLIC_APP_URL")).origin;
}
export function allowedOrigin(origin: string) {
  return (
    origin === appOrigin() ||
    (process.env.ALLOWED_EXTENSION_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .includes(origin)
  );
}
export function checkOrigin(request: Request, allowPublicExtension = false) {
  const origin = request.headers.get("origin");
  if (origin && !allowedOrigin(origin))
    throw new ApiFault(403, "origin_denied", "Origin is not allowed");
  if (
    !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
    !request.headers.get("authorization") &&
    origin !== appOrigin() &&
    !(allowPublicExtension && origin && allowedOrigin(origin))
  )
    throw new ApiFault(403, "csrf", "Same-origin request required");
}
export function encrypt(value: string) {
  const key = Buffer.from(required("APP_ENCRYPTION_KEY"), "hex");
  if (key.length !== 32)
    throw new ApiFault(
      503,
      "configuration_missing",
      "APP_ENCRYPTION_KEY must be 32 bytes in hex",
    );
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}
export function decrypt(value: string) {
  const data = Buffer.from(value, "base64url");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(required("APP_ENCRYPTION_KEY"), "hex"),
    data.subarray(0, 12),
  );
  cipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([
    cipher.update(data.subarray(28)),
    cipher.final(),
  ]).toString("utf8");
}
export const unsafeSecret =
  /(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:api[_ -]?key|password|authorization|secret|access[_ -]?token)\s*[:=]\s*\S{6,}|postgres(?:ql)?:\/\/[^\s]+|AIza[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9_]{20,})/i;
export const unsafeInstruction =
  /(?:ignore (?:all |previous |system )*instructions|reveal (?:your |the )?(?:system|secret|prompt)|execute (?:a |this )?(?:shell|command)|exfiltrat|send (?:the |all )?(?:api keys|secrets|credentials))/i;
export function safeCapture(value: unknown) {
  const serialized = JSON.stringify(value);
  if (unsafeSecret.test(serialized))
    throw new ApiFault(
      422,
      "redaction_required",
      "Remove credentials from the capture before submitting it",
    );
}
export function owns(resource: { user_id: string }, userId: string) {
  if (resource.user_id !== userId)
    throw new ApiFault(404, "not_found", "Resource not found");
}
