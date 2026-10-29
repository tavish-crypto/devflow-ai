import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
const forbidden =
  /GEMINI_API_KEY|SUPABASE_SECRET_KEY|GITHUB_PRIVATE_KEY_BASE64|GITHUB_CLIENT_SECRET|APP_ENCRYPTION_KEY|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/;
async function scan(dir) {
  let count = 0;
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const file = join(dir, item.name);
    if (item.isDirectory()) count += await scan(file);
    else if (/\.(?:js|json|html)$/.test(item.name)) {
      if (forbidden.test(await readFile(file, "utf8")))
        throw new Error(
          `Server-only secret identifier in browser artifact: ${file}`,
        );
      count++;
    }
  }
  return count;
}
const count =
  (await scan("apps/web/.next/static")) +
  (await scan("apps/extension/.output/chrome-mv3"));
console.log(
  `Browser boundary scan passed (${count} built artifacts). No server credential identifiers or private-key headers found.`,
);
