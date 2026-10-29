import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { ApiFault, hash, required } from "./security";
export function admin() {
  return createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SECRET_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function serverClient() {
  const jar = await cookies();
  return createServerClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (values) => {
          for (const { name, value, options } of values)
            jar.set(name, value, options);
        },
      },
    },
  );
}
export type Actor = { userId: string; db: SupabaseClient; extension: boolean };
export async function authenticate(
  request: Request,
  allowExtension = false,
): Promise<Actor> {
  const bearer = request.headers.get("authorization");
  if (bearer) {
    if (!allowExtension || !/^Bearer df_[A-Za-z0-9_-]{43}$/.test(bearer))
      throw new ApiFault(
        401,
        "unauthorized",
        "Invalid or unscoped bearer token",
      );
    const db = admin();
    const { data, error } = await db
      .from("extension_sessions")
      .select("user_id,expires_at,revoked_at,scopes")
      .eq("token_hash", hash(bearer.slice(7)))
      .maybeSingle();
    if (
      error ||
      !data ||
      data.revoked_at ||
      Date.parse(data.expires_at) <= Date.now()
    )
      throw new ApiFault(401, "unauthorized", "Session expired or revoked");
    const scope = new URL(request.url).pathname.endsWith("/analyze")
      ? "analyze"
      : request.method === "GET"
        ? "issues:read"
        : "issues:write";
    if (!Array.isArray(data.scopes) || !data.scopes.includes(scope))
      throw new ApiFault(
        403,
        "scope_denied",
        "Extension token lacks required scope",
      );
    return { userId: data.user_id, db, extension: true };
  }
  const db = await serverClient();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user)
    throw new ApiFault(401, "unauthorized", "Sign in required");
  return { userId: data.user.id, db, extension: false };
}
export function dbResult<T>(result: { data: T; error: unknown }): T {
  if (result.error)
    throw new ApiFault(503, "database_error", "Database operation failed");
  return result.data;
}
export async function rateLimit(key: string, limit = 30) {
  const { data, error } = await admin().rpc("take_rate_limit", {
    p_key: hash(key),
    p_limit: limit,
  });
  if (error)
    throw new ApiFault(
      503,
      "rate_limit_unavailable",
      "Rate limiter unavailable",
    );
  if (!data) throw new ApiFault(429, "rate_limited", "Try again in one minute");
}
