import tseslint from "typescript-eslint";
export default tseslint.config(
  {
    ignores: [
      "playwright-report/**",
      "test-results/**",
      ".local/**",
      "**/node_modules/**",
      "**/.next/**",
      "**/.output/**",
      "**/.wxt/**",
      "**/next-env.d.ts",
    ],
  },
  ...tseslint.configs.recommended,
);
