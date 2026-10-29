import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
describe("secret module boundaries", () => {
  it.each(["security", "ai", "supabase", "github", "issues", "http"])(
    "marks %s as server-only",
    (name) => {
      expect(readFileSync(`apps/web/src/lib/${name}.ts`, "utf8")).toContain(
        'import "server-only"',
      );
    },
  );
  it.each([
    "apps/web/src/app/ui.tsx",
    "apps/extension/entrypoints/popup/main.tsx",
  ])("keeps provider/admin secrets out of %s", (path) => {
    const source = readFileSync(path, "utf8");
    expect(source).not.toMatch(
      /GEMINI_API_KEY|SUPABASE_SECRET_KEY|GITHUB_PRIVATE_KEY_BASE64|APP_ENCRYPTION_KEY/,
    );
    expect(source).not.toMatch(
      /from ["'][^"']*lib\/(?:supabase|github|ai|security)/,
    );
  });
});
