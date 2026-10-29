import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { productionOrigin } from "./lib/release-config.mjs";
const origin = productionOrigin(process.env.VITE_DEVFLOW_APP_URL);
if (!origin) {
  console.error(
    "Production extension packaging requires VITE_DEVFLOW_APP_URL set to the verified exact HTTPS backend origin. No package created.",
  );
  process.exit(1);
}
// WXT builds and archives the selected app; inherit only the public API origin, never inline provider credentials.
const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(
  command,
  ["--filter", "@devflow/extension", "exec", "wxt", "zip"],
  { stdio: "inherit", env: { ...process.env, VITE_DEVFLOW_APP_URL: origin } },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
const dir = "apps/extension/.output";
const manifest = JSON.parse(
  await readFile(`${dir}/chrome-mv3/manifest.json`, "utf8"),
);
if (
  manifest.host_permissions?.length !== 1 ||
  manifest.host_permissions[0] !== `${origin}/*` ||
  manifest.manifest_version !== 3 ||
  !manifest.background?.service_worker ||
  !manifest.side_panel?.default_path
)
  throw new Error(
    "Extension manifest does not match production origin or required MV3 entrypoints",
  );
const { readdir } = await import("node:fs/promises");
for (const file of await readdir(dir)) {
  if (file.endsWith(".zip") && !file.includes("-sources")) {
    const bytes = await readFile(`${dir}/${file}`);
    const sha = createHash("sha256").update(bytes).digest("hex");
    await writeFile(`${dir}/${file}.sha256`, `${sha}  ${file}\n`);
    console.log(`Package: ${dir}/${file}; sha256=${sha}`);
  }
}
