import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);
const checks = [
  new RegExp("AIza" + "[A-Za-z0-9_-]{30,}"),
  new RegExp("gh[pousr]_" + "[A-Za-z0-9_]{30,}"),
  /postgres(?:ql)?:\/\/[^\s:]+:[^\s@]+@/,
  /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/,
];
const failures = [];
for (const file of files) {
  if (
    file === "pnpm-lock.yaml" ||
    file.startsWith("tests/") ||
    file === "scripts/check-secrets.mjs"
  )
    continue;
  const text = readFileSync(file, "utf8");
  if (checks.some((r) => r.test(text))) failures.push(file);
}
if (failures.length) {
  console.error("Possible secrets in files:", failures.join(", "));
  process.exitCode = 1;
} else
  console.log(
    `Secret pattern scan passed (${files.length} repository files; test fixtures and lockfile excluded).`,
  );
