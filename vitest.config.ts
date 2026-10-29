import { defineConfig } from "vitest/config";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const web = createRequire(new URL("./apps/web/package.json", import.meta.url));
const extension = createRequire(
  new URL("./apps/extension/package.json", import.meta.url),
);
export default defineConfig({
  test: {
    include: [
      "tests/backend/**/*.test.ts",
      "tests/frontend/**/*.test.{ts,tsx}",
    ],
    env: { NODE_ENV: "test" },
  },
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: [
      { find: "wxt/browser", replacement: extension.resolve("wxt/browser") },
      {
        find: "wxt/utils/define-background",
        replacement: extension.resolve("wxt/utils/define-background"),
      },
      {
        find: "server-only",
        replacement: fileURLToPath(
          new URL("./tests/backend/server-only.ts", import.meta.url),
        ),
      },
      {
        find: "@devflow/contracts",
        replacement: fileURLToPath(
          new URL("./packages/contracts/src/index.ts", import.meta.url),
        ),
      },
      {
        find: "@devflow/product/api",
        replacement: fileURLToPath(
          new URL("./packages/product/src/api.ts", import.meta.url),
        ),
      },
      {
        find: "@devflow/product",
        replacement: fileURLToPath(
          new URL("./packages/product/src/index.tsx", import.meta.url),
        ),
      },
      ...[
        "@supabase/ssr",
        "@supabase/supabase-js",
        "next/headers",
        "next/navigation",
        "@octokit/auth-app",
      ].map((name) => ({ find: name, replacement: web.resolve(name) })),
    ],
  },
});
