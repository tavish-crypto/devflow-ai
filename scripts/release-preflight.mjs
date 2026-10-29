import { createPrivateKey } from "node:crypto";
import { runtimeProblems, requiredRuntime } from "./lib/release-config.mjs";
const problems = runtimeProblems(process.env);
if (process.env.GITHUB_PRIVATE_KEY_BASE64) {
  try {
    const key = createPrivateKey(
      Buffer.from(process.env.GITHUB_PRIVATE_KEY_BASE64, "base64"),
    );
    if (key.asymmetricKeyType !== "rsa")
      problems.push("GITHUB_PRIVATE_KEY_BASE64: RSA private key required");
  } catch {
    problems.push("GITHUB_PRIVATE_KEY_BASE64: invalid private key");
  }
}
for (const name of requiredRuntime)
  console.log(`${name}: ${process.env[name] ? "present" : "absent"}`);
if (problems.length) {
  console.error("Release configuration blocked:\n" + problems.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    "Configuration checks passed. Live provider, migration, preview and browser checks are still required before production.",
  );
