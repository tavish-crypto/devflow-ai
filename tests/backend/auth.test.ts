import { afterEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  server: vi.fn(),
  admin: vi.fn(),
  session: vi.fn(),
}));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.server }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.admin }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: vi.fn() }),
}));
import { authenticate } from "../../apps/web/src/lib/supabase";
import { user } from "./fixtures";
function setup() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "public");
  vi.stubEnv("SUPABASE_SECRET_KEY", "server");
  mocks.server.mockReturnValue({ auth: { getUser: mocks.getUser } });
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: mocks.session,
  };
  mocks.admin.mockReturnValue({ from: () => chain });
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
describe("validated identity and extension scope", () => {
  it("rejects missing session", async () => {
    setup();
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(
      authenticate(new Request("https://app.test")),
    ).rejects.toMatchObject({ status: 401 });
  });
  it("uses validated Supabase identity", async () => {
    setup();
    mocks.getUser.mockResolvedValue({
      data: { user: { id: user } },
      error: null,
    });
    expect((await authenticate(new Request("https://app.test"))).userId).toBe(
      user,
    );
  });
  it("rejects expired auth", async () => {
    setup();
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error("expired"),
    });
    await expect(
      authenticate(new Request("https://app.test")),
    ).rejects.toMatchObject({ status: 401 });
  });
  it("denies extension token on dashboard-only routes", async () => {
    setup();
    await expect(
      authenticate(
        new Request("https://app.test", {
          headers: { authorization: "Bearer df_" + "a".repeat(43) },
        }),
      ),
    ).rejects.toMatchObject({ status: 401 });
  });
  it("accepts valid scoped token on permitted routes", async () => {
    setup();
    mocks.session.mockResolvedValue({
      data: {
        user_id: user,
        expires_at: new Date(Date.now() + 60000).toISOString(),
        revoked_at: null,
        scopes: ["issues:read"],
      },
      error: null,
    });
    expect(
      (
        await authenticate(
          new Request("https://app.test", {
            headers: { authorization: "Bearer df_" + "a".repeat(43) },
          }),
          true,
        )
      ).extension,
    ).toBe(true);
  });
  it.each([
    { expires_at: "2020-01-01", revoked_at: null },
    { expires_at: "2090-01-01", revoked_at: "2026-01-01" },
  ])("rejects revoked or expired extension sessions", async (session) => {
    setup();
    mocks.session.mockResolvedValue({
      data: { user_id: user, ...session },
      error: null,
    });
    await expect(
      authenticate(
        new Request("https://app.test", {
          headers: { authorization: "Bearer df_" + "a".repeat(43) },
        }),
        true,
      ),
    ).rejects.toMatchObject({ status: 401 });
  });
  it("rejects arbitrary bearer tokens", async () => {
    setup();
    await expect(
      authenticate(
        new Request("https://app.test", {
          headers: { authorization: "Bearer fake-user-id" },
        }),
        true,
      ),
    ).rejects.toMatchObject({ status: 401 });
  });
});

it("rejects an extension token that lacks the requested scope", async () => {
  setup();
  mocks.session.mockResolvedValue({
    data: {
      user_id: user,
      expires_at: new Date(Date.now() + 60000).toISOString(),
      revoked_at: null,
      scopes: ["issues:read"],
    },
    error: null,
  });
  await expect(
    authenticate(
      new Request("https://app.test/api/v1/analyze", {
        method: "POST",
        headers: { authorization: "Bearer df_" + "a".repeat(43) },
      }),
      true,
    ),
  ).rejects.toMatchObject({ status: 403, code: "scope_denied" });
});
