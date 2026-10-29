import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  serverClient: vi.fn(),
  rateLimit: vi.fn(),
  signInWithOtp: vi.fn(),
}));
vi.mock("../../apps/web/src/lib/supabase", () => ({
  serverClient: mocks.serverClient,
  rateLimit: mocks.rateLimit,
}));
import { POST } from "../../apps/web/src/app/auth/login/route";

const origin = "https://app.example.test";
function request(email = "owner@example.test", requestOrigin = origin) {
  return new Request(`${origin}/auth/login`, {
    method: "POST",
    headers: {
      origin: requestOrigin,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ email }),
  });
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", origin);
  mocks.serverClient.mockResolvedValue({
    auth: { signInWithOtp: mocks.signInWithOtp },
  });
  mocks.signInWithOtp.mockResolvedValue({ error: null });
});
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

describe("email sign-in", () => {
  it("reports the provider email quota as 429 with actionable text", async () => {
    mocks.signInWithOtp.mockResolvedValue({
      error: {
        code: "over_email_send_rate_limit",
        status: 429,
        message: "provider-internal-details",
      },
    });
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      code: "email_rate_limited",
      message:
        "Email sending limit reached. Please wait before requesting another sign-in link.",
    });
    expect(mocks.signInWithOtp).toHaveBeenCalledTimes(1);
  });

  it("keeps unexpected provider errors private", async () => {
    mocks.signInWithOtp.mockResolvedValue({
      error: {
        code: "unexpected_failure",
        message: "provider-internal-details",
      },
    });
    const response = await POST(request());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: "login_failed",
      message: "Unable to send magic link",
    });
  });

  it("requests a single link with the configured callback", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(mocks.signInWithOtp).toHaveBeenCalledExactlyOnceWith({
      email: "owner@example.test",
      options: { emailRedirectTo: `${origin}/auth/callback` },
    });
  });

  it("rejects another origin before requesting email", async () => {
    const response = await POST(
      request("owner@example.test", "https://evil.test"),
    );
    expect(response.status).toBe(403);
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();
  });

  it("rejects invalid email before contacting the provider", async () => {
    const response = await POST(request("invalid"));
    expect(response.status).toBe(400);
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();
  });
});
