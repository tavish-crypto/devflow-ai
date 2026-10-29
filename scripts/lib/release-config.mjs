export const requiredRuntime = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "GEMINI_API_KEY",
  "GITHUB_APP_ID",
  "GITHUB_APP_SLUG",
  "GITHUB_PRIVATE_KEY_BASE64",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "APP_ENCRYPTION_KEY",
  "ALLOWED_EXTENSION_ORIGINS",
];
export function productionOrigin(value) {
  try {
    const u = new URL(value);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.pathname !== "/" ||
      u.search ||
      u.hash ||
      u.port ||
      u.hostname === "localhost" ||
      u.hostname.endsWith(".localhost") ||
      u.hostname === "127.0.0.1" ||
      u.hostname === "[::1]"
    )
      return null;
    return u.origin;
  } catch {
    return null;
  }
}
export function runtimeProblems(values) {
  const problems = requiredRuntime
    .filter((n) => !values[n]?.trim())
    .map((name) => `${name}: missing`);
  for (const name of ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SUPABASE_URL"])
    if (values[name] && !productionOrigin(values[name]))
      problems.push(`${name}: requires an exact HTTPS production origin`);
  if (
    values.APP_ENCRYPTION_KEY &&
    !/^[a-fA-F0-9]{64}$/.test(values.APP_ENCRYPTION_KEY)
  )
    problems.push("APP_ENCRYPTION_KEY: requires 64 hexadecimal characters");
  if (values.GITHUB_APP_ID && !/^[1-9][0-9]*$/.test(values.GITHUB_APP_ID))
    problems.push("GITHUB_APP_ID: requires a positive numeric App ID");
  if (
    values.ALLOWED_EXTENSION_ORIGINS &&
    !values.ALLOWED_EXTENSION_ORIGINS.split(",").every((v) =>
      /^chrome-extension:\/\/[a-p]{32}$/.test(v.trim()),
    )
  )
    problems.push(
      "ALLOWED_EXTENSION_ORIGINS: requires exact Chrome extension origins",
    );
  return problems;
}
