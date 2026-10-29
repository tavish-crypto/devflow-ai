import { readBody } from "../../../../lib/http";
import { NextResponse } from "next/server";
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import {
  AnalyzeRequestSchema,
  CreateIssueSchema,
  PatchIssueSchema,
  PublishRequestSchema,
  PairingStartSchema,
  PairingConfirmSchema,
  PairingStatusSchema,
  PairingRevokeSchema,
  AccountResponseSchema,
  DisconnectRequestSchema,
} from "@devflow/contracts";
import { analyze } from "../../../../lib/ai";
import {
  ApiFault,
  allowedOrigin,
  checkOrigin,
  hash,
  safeCapture,
  secret,
  owns,
} from "../../../../lib/security";
import {
  admin,
  authenticate,
  dbResult,
  rateLimit,
} from "../../../../lib/supabase";
import {
  getIssue,
  issueDTO,
  publish,
  reconcile,
  type IssueRow,
} from "../../../../lib/issues";
import {
  authorizeRepo,
  duplicates,
  repositories,
} from "../../../../lib/github";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function dispatch(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname.replace("/api/v1/", "");
  const method = request.method;
  checkOrigin(request, path === "pairing/start" || path === "pairing/status");
  if (path === "health" && method === "GET")
    return {
      status: "ok",
      version: 1,
      integrations: {
        supabase: !!(
          process.env.NEXT_PUBLIC_SUPABASE_URL &&
          process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
          process.env.SUPABASE_SECRET_KEY
        ),
        gemini: !!process.env.GEMINI_API_KEY,
        github: !!(
          process.env.GITHUB_APP_ID &&
          process.env.GITHUB_PRIVATE_KEY_BASE64 &&
          process.env.GITHUB_CLIENT_ID &&
          process.env.GITHUB_CLIENT_SECRET &&
          process.env.APP_ENCRYPTION_KEY
        ),
      },
    };
  if (path === "pairing/start" && method === "POST") {
    PairingStartSchema.parse(await readBody(request));
    await rateLimit("pairing:start:global", 60);
    const pollingSecret = secret();
    const code = randomBytes(4).toString("hex").toUpperCase();
    const data = dbResult(
      await admin()
        .from("extension_pairings")
        .insert({ polling_hash: hash(pollingSecret), code })
        .select("id,expires_at")
        .single(),
    );
    if (!data)
      throw new ApiFault(503, "database_error", "Pairing creation failed");
    return {
      pairingId: data.id,
      code,
      pollingSecret,
      expiresAt: new Date(data.expires_at).toISOString(),
    };
  }
  if (path === "pairing/status" && method === "POST") {
    const body = PairingStatusSchema.parse(await readBody(request));
    await rateLimit("pairing:status:global", 300);
    await rateLimit(`pairing:poll:${body.pairingId}`, 30);
    const token = `df_${secret()}`;
    const { data, error } = await admin().rpc("exchange_pairing", {
      p_id: body.pairingId,
      p_polling_hash: hash(body.pollingSecret),
      p_token_hash: hash(token),
    });
    if (error)
      throw new ApiFault(
        410,
        "pairing_invalid",
        "Pairing expired, invalid or already exchanged",
      );
    return data.status === "approved"
      ? {
          ...data,
          expiresAt: new Date(data.expiresAt).toISOString(),
          token,
          scopes: ["analyze", "issues:read", "issues:write"],
        }
      : data;
  }
  const extensionAllowed =
    path === "analyze" || path === "issues" || /^issues\/[^/]+$/.test(path);
  const actor = await authenticate(request, extensionAllowed);
  await rateLimit(`user:${actor.userId}`, 60);
  if (path === "account" && method === "GET") {
    const db = admin();
    const sessions = dbResult(
      await db
        .from("extension_sessions")
        .select("id,expires_at,revoked_at")
        .eq("user_id", actor.userId)
        .order("created_at", { ascending: false })
        .limit(50),
    );
    const connection = dbResult(
      await db
        .from("github_connections")
        .select("user_id")
        .eq("user_id", actor.userId)
        .maybeSingle(),
    );
    const {
      data: { user },
    } = await actor.db.auth.getUser();
    return AccountResponseSchema.parse({
      email: user?.email ?? null,
      githubConnected: !!connection,
      sessions: (sessions ?? []).map((s) => ({
        id: s.id,
        expiresAt: new Date(s.expires_at).toISOString(),
        revokedAt: s.revoked_at ? new Date(s.revoked_at).toISOString() : null,
      })),
    });
  }
  if (path === "github/disconnect" && method === "POST") {
    DisconnectRequestSchema.parse(await readBody(request));
    dbResult(
      await admin()
        .from("github_connections")
        .delete()
        .eq("user_id", actor.userId),
    );
    return { disconnected: true };
  }
  if (path === "analyze" && method === "POST") {
    const body = AnalyzeRequestSchema.parse(await readBody(request));
    await rateLimit(`analyze:${actor.userId}`, 10);
    return analyze(body.capture);
  }
  if (path === "issues" && method === "GET") {
    const rows = dbResult(
      await actor.db
        .from("issues")
        .select("*")
        .eq("user_id", actor.userId)
        .order("created_at", { ascending: false })
        .limit(100),
    );
    return { issues: (rows as IssueRow[]).map(issueDTO) };
  }
  if (path === "issues" && method === "POST") {
    const body = CreateIssueSchema.parse(await readBody(request));
    safeCapture(body);
    const row = dbResult(
      await admin().rpc("create_issue", {
        p_user: actor.userId,
        p_report: body.report,
        p_capture: body.capture,
        p_owner: body.repoOwner ?? null,
        p_repo: body.repoName ?? null,
      }),
    );
    return { issue: issueDTO(row) };
  }
  const issueMatch = /^issues\/([^/]+)(?:\/(publish|reconcile))?$/.exec(path);
  if (issueMatch) {
    const id = z.uuid().parse(issueMatch[1]);
    const row = await getIssue(actor, id);
    owns(row, actor.userId);
    if (!issueMatch[2] && method === "GET") return { issue: issueDTO(row) };
    if (!issueMatch[2] && method === "PATCH") {
      const body = PatchIssueSchema.parse(await readBody(request));
      safeCapture(body);
      const { data, error } = await admin().rpc("edit_issue", {
        p_user: actor.userId,
        p_id: id,
        p_report: body.report ?? null,
        p_owner: body.repoOwner ?? null,
        p_repo: body.repoName ?? null,
      });
      if (error)
        throw new ApiFault(
          409,
          "not_editable",
          "Only draft and failed issues are editable",
        );
      return { issue: issueDTO(data) };
    }
    if (issueMatch[2] === "publish" && method === "POST") {
      const body = PublishRequestSchema.parse(await readBody(request));
      safeCapture(row.report);
      return publish(actor, id, body.idempotencyKey);
    }
    if (issueMatch[2] === "reconcile" && method === "POST") {
      z.object({ confirmed: z.literal(true) })
        .strict()
        .parse(await readBody(request));
      return reconcile(actor, id);
    }
  }
  if (path === "github/repositories" && method === "GET")
    return { repositories: await repositories(actor) };
  if (path === "github/duplicates" && method === "GET") {
    const query = z
      .object({
        owner: z.string().regex(/^[a-zA-Z0-9_.-]{1,100}$/),
        repo: z.string().regex(/^[a-zA-Z0-9_.-]{1,100}$/),
        title: z.string().min(1).max(200),
      })
      .parse(Object.fromEntries(url.searchParams));
    const token = await authorizeRepo(actor, query.owner, query.repo);
    return {
      candidates: await duplicates(token, query.owner, query.repo, query.title),
    };
  }
  if (path === "pairing/confirm" && method === "POST") {
    const body = PairingConfirmSchema.parse(await readBody(request));
    await rateLimit(`pairing:confirm:${actor.userId}`, 5);
    const { data, error } = await admin().rpc("confirm_pairing", {
      p_user: actor.userId,
      p_code: body.code,
    });
    if (error)
      throw new ApiFault(
        410,
        "pairing_invalid",
        "Pairing code expired or already approved",
      );
    return { pairingId: data, status: "approved" };
  }
  if (path === "pairing/revoke" && method === "POST") {
    const body = PairingRevokeSchema.parse(await readBody(request));
    const { data, error } = await admin()
      .from("extension_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", actor.userId)
      .eq("id", body.sessionId)
      .select("id")
      .maybeSingle();
    if (error)
      throw new ApiFault(503, "database_error", "Unable to revoke session");
    if (!data) throw new ApiFault(404, "not_found", "Session not found");
    return { revoked: true };
  }
  throw new ApiFault(404, "not_found", "Endpoint not found");
}
async function handle(request: Request) {
  const requestId = randomUUID();
  let response: NextResponse;
  try {
    response = NextResponse.json(await dispatch(request));
  } catch (error) {
    const fault =
      error instanceof ApiFault
        ? error
        : error instanceof z.ZodError
          ? new ApiFault(400, "validation_error", "Request failed validation")
          : new ApiFault(500, "internal_error", "Request failed");
    console.warn(
      JSON.stringify({ requestId, code: fault.code, status: fault.status }),
    );
    response = NextResponse.json(
      { code: fault.code, message: fault.message, requestId },
      { status: fault.status },
    );
  }
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Request-Id", requestId);
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (allowedOrigin(origin)) {
        response.headers.set("Access-Control-Allow-Origin", origin);
        response.headers.set("Vary", "Origin");
      }
    } catch {
      /* Unconfigured origin is denied. */
    }
  }
  return response;
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  try {
    if (!origin || !allowedOrigin(origin))
      return new NextResponse(null, { status: 403 });
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        Vary: "Origin",
      },
    });
  } catch {
    return new NextResponse(null, { status: 403 });
  }
}
