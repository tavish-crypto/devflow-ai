import { afterEach, describe, it, expect, vi } from "vitest";
const mock = vi.hoisted(() => ({ authenticate: vi.fn(), rateLimit: vi.fn() }));
vi.mock("../../apps/web/src/lib/supabase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../apps/web/src/lib/supabase")>()),
  authenticate: mock.authenticate,
  rateLimit: mock.rateLimit,
}));
import {
  GET,
  POST,
  OPTIONS,
} from "../../apps/web/src/app/api/v1/[...path]/route";
import { readBody } from "../../apps/web/src/lib/http";
import { ApiFault } from "../../apps/web/src/lib/security";
import { capture, user } from "./fixtures";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
describe("HTTP boundaries", () => {
  it("serves health without pretending integrations are tested", async () => {
    const r = await GET(new Request("http://localhost/api/v1/health"));
    expect(r.status).toBe(200);
    expect((await r.json()).status).toBe("ok");
    expect(r.headers.get("Cache-Control")).toBe("no-store");
  });
  it("private issue listing requires authentication", async () => {
    mock.authenticate.mockRejectedValue(
      new ApiFault(401, "unauthorized", "Sign in required"),
    );
    const r = await GET(new Request("http://localhost/api/v1/issues"));
    expect(r.status).toBe(401);
    expect((await r.json()).requestId).toBeTruthy();
  });
  it("does not leak internal errors", async () => {
    mock.authenticate.mockRejectedValue(new Error("secret-token"));
    const r = await GET(new Request("http://localhost/api/v1/issues"));
    expect(await r.text()).not.toContain("secret-token");
  });
  it("rejects missing consent at HTTP boundary", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost");
    mock.authenticate.mockResolvedValue({ userId: user });
    const r = await POST(
      new Request("http://localhost/api/v1/analyze", {
        method: "POST",
        headers: {
          origin: "http://localhost",
          "content-type": "application/json",
        },
        body: JSON.stringify({ capture }),
      }),
    );
    expect(r.status).toBe(400);
  });
  it("rejects content types other than JSON", async () => {
    await expect(
      readBody(new Request("http://localhost", { method: "POST", body: "{}" })),
    ).rejects.toMatchObject({ status: 415 });
  });
  it("rejects oversized streamed bodies", async () => {
    await expect(
      readBody(
        new Request("http://localhost", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "x".repeat(64001),
        }),
      ),
    ).rejects.toMatchObject({ status: 413 });
  });
  it("rejects malformed JSON", async () => {
    await expect(
      readBody(
        new Request("http://localhost", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{",
        }),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it("denies unapproved CORS preflight", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost");
    const r = await OPTIONS(
      new Request("http://localhost/api/v1/analyze", {
        headers: { origin: "chrome-extension://evil" },
      }),
    );
    expect(r.status).toBe(403);
  });
  it("allows only configured extension CORS preflight", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost");
    vi.stubEnv("ALLOWED_EXTENSION_ORIGINS", "chrome-extension://abc");
    const r = await OPTIONS(
      new Request("http://localhost/api/v1/analyze", {
        headers: { origin: "chrome-extension://abc" },
      }),
    );
    expect(r.status).toBe(204);
    expect(r.headers.get("Access-Control-Allow-Origin")).toBe(
      "chrome-extension://abc",
    );
  });
});
