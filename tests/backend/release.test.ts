import { describe, it, expect } from "vitest";
import {
  productionOrigin,
  runtimeProblems,
} from "../../scripts/lib/release-config.mjs";
describe("release safety gates", () => {
  it.each([
    "http://localhost:3000",
    "https://localhost",
    "https://127.0.0.1",
    "https://[::1]",
    "https://user:password@example.com",
    "https://example.com/path",
    "https://example.com?token=x",
    "not-a-url",
  ])("refuses non-production origin %s", (url) =>
    expect(productionOrigin(url)).toBeNull(),
  );
  it("accepts only the exact HTTPS deployment origin", () =>
    expect(productionOrigin("https://devflow.example.com/")).toBe(
      "https://devflow.example.com",
    ));
  it("fails closed without credentials", () => {
    expect(runtimeProblems({})).toContain("GEMINI_API_KEY: missing");
    expect(runtimeProblems({})).toContain("SUPABASE_SECRET_KEY: missing");
  });
  it("checks local encryption material and exact extension origins", () => {
    const problems = runtimeProblems({
      APP_ENCRYPTION_KEY: "placeholder",
      ALLOWED_EXTENSION_ORIGINS: "*",
    });
    expect(problems).toContain(
      "APP_ENCRYPTION_KEY: requires 64 hexadecimal characters",
    );
    expect(problems).toContain(
      "ALLOWED_EXTENSION_ORIGINS: requires exact Chrome extension origins",
    );
  });
});
