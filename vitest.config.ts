import { defineConfig } from "vitest/config";
import { createRequire } from "node:module";
const web = createRequire(new URL("./apps/web/package.json", import.meta.url));
export default defineConfig({
  test: { include: ["tests/backend/**/*.test.ts"], env: { NODE_ENV: "test" } },
  resolve: {
    alias: [
      {
        find: "server-only",
        replacement: new URL("./tests/backend/server-only.ts", import.meta.url)
          .pathname,
      },
      {
        find: "@devflow/contracts",
        replacement: new URL(
          "./packages/contracts/src/index.ts",
          import.meta.url,
        ).pathname,
      },
      ...[
        "@supabase/ssr",
        "@supabase/supabase-js",
        "next/headers",
        "@octokit/auth-app",
      ].map((name) => ({ find: name, replacement: web.resolve(name) })),
    ],
  },
});
