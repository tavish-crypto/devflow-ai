// Test-only Auth provider. The application has no test bypass or alternate auth path.
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const user = {
  id: "00000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "demo@example.test",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-10-29T10:00:00Z",
};
const auth = createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (req.url?.startsWith("/auth/v1/user") && req.headers.authorization)
    res.end(JSON.stringify(user));
  else {
    res.statusCode = 401;
    res.end(JSON.stringify({ message: "Test auth requires a fixture token" }));
  }
});
await new Promise((resolve) => auth.listen(45451, "127.0.0.1", resolve));
const require = createRequire(
  new URL("../../apps/web/package.json", import.meta.url),
);
const child = spawn(
  process.execPath,
  [require.resolve("next/dist/bin/next"), "start", "--hostname", "0.0.0.0"],
  {
    cwd: new URL("../../apps/web", import.meta.url),
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:45451",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-public-key",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    child.kill();
    auth.close();
    process.exit(0);
  });
child.on("exit", (code) => {
  auth.close();
  process.exit(code ?? 1);
});
