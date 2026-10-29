import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  admin: vi.fn(),
  rateLimit: vi.fn(),
  result: vi.fn(),
  eq: vi.fn(),
  exchange: vi.fn(),
}));
vi.mock("../../apps/web/src/lib/supabase", async (original) => ({
  ...(await original<typeof import("../../apps/web/src/lib/supabase")>()),
  authenticate: mocks.authenticate,
  admin: mocks.admin,
  rateLimit: mocks.rateLimit,
}));
import { GET, POST } from "../../apps/web/src/app/api/v1/[...path]/route";
import { user, id } from "./fixtures";
import {
  PairingStartResponseSchema,
  PairingStatusResponseSchema,
} from "@devflow/contracts";
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost");
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: mocks.eq.mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: mocks.result,
    maybeSingle: mocks.result,
    delete: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    single: mocks.result,
    then: (resolve: (result: unknown) => void) =>
      resolve({ data: null, error: null }),
  };
  mocks.admin.mockReturnValue({
    from: vi.fn().mockReturnValue(query),
    rpc: mocks.exchange,
  });
  mocks.authenticate.mockResolvedValue({
    userId: user,
    extension: false,
    db: {
      auth: {
        getUser: async () => ({
          data: { user: { email: "kartik@example.test" } },
        }),
      },
    },
  });
});
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});
it("normalizes Supabase pairing creation timestamps to the shared UTC contract", async () => {
  mocks.result.mockResolvedValue({
    data: { id, expires_at: "2026-10-29T17:30:00+05:30" },
    error: null,
  });
  const r = await POST(
    new Request("http://localhost/api/v1/pairing/start", {
      method: "POST",
      headers: {
        origin: "http://localhost",
        "Content-Type": "application/json",
      },
      body: "{}",
    }),
  );
  expect(r.status).toBe(200);
  const body = PairingStartResponseSchema.parse(await r.json());
  expect(body.expiresAt).toBe("2026-10-29T12:00:00.000Z");
});
it("normalizes one-time pairing exchange timestamps without changing token scope", async () => {
  mocks.exchange.mockResolvedValue({
    data: {
      status: "approved",
      sessionId: id,
      expiresAt: "2026-10-29T17:30:00+05:30",
    },
    error: null,
  });
  const r = await POST(
    new Request("http://localhost/api/v1/pairing/status", {
      method: "POST",
      headers: {
        origin: "http://localhost",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pairingId: id, pollingSecret: "a".repeat(43) }),
    }),
  );
  expect(r.status).toBe(200);
  const body = PairingStatusResponseSchema.parse(await r.json());
  expect(body.status).toBe("approved");
  if (body.status === "approved") {
    expect(body.expiresAt).toBe("2026-10-29T12:00:00.000Z");
    expect(body.scopes).toEqual(["analyze", "issues:read", "issues:write"]);
  }
});
it("returns only public session metadata filtered to authenticated owner", async () => {
  mocks.result
    .mockResolvedValueOnce({
      data: [{ id, expires_at: "2026-10-29T17:30:00+05:30", revoked_at: null }],
      error: null,
    })
    .mockResolvedValueOnce({ data: { user_id: user }, error: null });
  const response = await GET(new Request("http://localhost/api/v1/account"));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    email: "kartik@example.test",
    githubConnected: true,
    sessions: [{ id, expiresAt: "2026-10-29T12:00:00.000Z", revokedAt: null }],
  });
  expect(mocks.eq).toHaveBeenNthCalledWith(1, "user_id", user);
  expect(mocks.eq).toHaveBeenNthCalledWith(2, "user_id", user);
});
it("requires explicit confirmation and same origin before disconnecting", async () => {
  const response = await POST(
    new Request("http://localhost/api/v1/github/disconnect", {
      method: "POST",
      headers: {
        origin: "http://localhost",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ confirmed: true }),
    }),
  );
  expect(response.status).toBe(200);
  expect(mocks.eq).toHaveBeenCalledWith("user_id", user);
});
it("rejects forged disconnect owners", async () => {
  const response = await POST(
    new Request("http://localhost/api/v1/github/disconnect", {
      method: "POST",
      headers: {
        origin: "http://localhost",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ confirmed: true, userId: id }),
    }),
  );
  expect(response.status).toBe(400);
  expect(mocks.admin).not.toHaveBeenCalled();
});
it("fails closed if session metadata storage fails", async () => {
  mocks.result.mockResolvedValue({
    data: null,
    error: new Error("private upstream"),
  });
  const r = await GET(new Request("http://localhost/api/v1/account"));
  expect(r.status).toBe(503);
  expect(await r.text()).not.toContain("private upstream");
});
it("keeps both new endpoints dashboard-only", async () => {
  mocks.result.mockResolvedValue({ data: [], error: null });
  await GET(new Request("http://localhost/api/v1/account"));
  expect(mocks.authenticate).toHaveBeenCalledWith(expect.any(Request), false);
});
