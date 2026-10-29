import { afterEach, describe, it, expect, vi } from "vitest";
import {
  allowedOrigin,
  checkOrigin,
  encrypt,
  decrypt,
  hash,
  secret,
  owns,
  safeCapture,
} from "../../apps/web/src/lib/security";
import { capture, user } from "./fixtures";
afterEach(() => vi.unstubAllEnvs());
describe("security boundaries", () => {
  it("hashes high entropy polling secrets", () => {
    const a = secret(),
      b = secret();
    expect(a).toHaveLength(43);
    expect(a).not.toBe(b);
    expect(hash(a)).toHaveLength(64);
    expect(hash(a)).not.toContain(a);
  });
  it("encrypts tokens and detects tampering", () => {
    vi.stubEnv("APP_ENCRYPTION_KEY", "ab".repeat(32));
    const e = encrypt("private-token");
    expect(e).not.toContain("private-token");
    expect(decrypt(e)).toBe("private-token");
    const bytes = Buffer.from(e, "base64url");
    bytes[20] ^= 1;
    expect(() => decrypt(bytes.toString("base64url"))).toThrow();
  });
  it("rejects malformed encryption keys", () => {
    vi.stubEnv("APP_ENCRYPTION_KEY", "abc");
    expect(() => encrypt("x")).toThrow();
  });
  it("enforces ownership", () => {
    expect(() => owns({ user_id: user }, user)).not.toThrow();
    expect(() => owns({ user_id: "other" }, user)).toThrow();
  });
  it("denies cross origin cookie mutations", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com");
    expect(() =>
      checkOrigin(
        new Request("https://app.example.com/api", {
          method: "POST",
          headers: { origin: "https://evil.example" },
        }),
      ),
    ).toThrow();
  });
  it("denies cookie mutation without origin", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com");
    expect(() =>
      checkOrigin(
        new Request("https://app.example.com/api", { method: "POST" }),
      ),
    ).toThrow();
  });
  it("accepts same origin mutation", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com");
    expect(() =>
      checkOrigin(
        new Request("https://app.example.com/api", {
          method: "POST",
          headers: { origin: "https://app.example.com" },
        }),
      ),
    ).not.toThrow();
  });
  it("restricts extension origins to exact allowlist", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com");
    vi.stubEnv("ALLOWED_EXTENSION_ORIGINS", "chrome-extension://abc");
    expect(allowedOrigin("chrome-extension://abc")).toBe(true);
    expect(allowedOrigin("chrome-extension://abcd")).toBe(false);
  });
  it.each([
    "postgresql://u:p@db/postgres",
    "-----BEGIN PRIVATE KEY-----",
    "authorization=BearerToken123",
    "AIza" + "x".repeat(30),
  ])("blocks secret %s", (value) =>
    expect(() => safeCapture({ selectedText: value })).toThrow(),
  );
  it("accepts ordinary evidence", () =>
    expect(() => safeCapture(capture)).not.toThrow());
});

describe("public extension pairing origins", () => {
  it("allows configured extension origins to start or poll without a bearer", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com");
    vi.stubEnv("ALLOWED_EXTENSION_ORIGINS", "chrome-extension://abc");
    const request = new Request(
      "https://app.example.com/api/v1/pairing/start",
      { method: "POST", headers: { origin: "chrome-extension://abc" } },
    );
    expect(() => checkOrigin(request, true)).not.toThrow();
    expect(() => checkOrigin(request)).toThrow();
  });
  it("still denies unconfigured extension origins for public pairing", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com");
    vi.stubEnv("ALLOWED_EXTENSION_ORIGINS", "chrome-extension://abc");
    expect(() =>
      checkOrigin(
        new Request("https://app.example.com/api/v1/pairing/start", {
          method: "POST",
          headers: { origin: "chrome-extension://evil" },
        }),
        true,
      ),
    ).toThrow();
  });
});
