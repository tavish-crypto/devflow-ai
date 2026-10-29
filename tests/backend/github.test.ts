import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ connection: vi.fn(), auth: vi.fn() }));
vi.mock("../../apps/web/src/lib/supabase", () => ({
  admin: () => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: mocks.connection,
    };
    return { from: () => chain };
  },
}));
vi.mock("@octokit/auth-app", () => ({ createAppAuth: () => mocks.auth }));
import {
  repositories,
  authorizeRepo,
  reconcileRemote,
} from "../../apps/web/src/lib/github";
import { encrypt } from "../../apps/web/src/lib/security";
import type { Actor } from "../../apps/web/src/lib/supabase";
import { user, key } from "./fixtures";
const actor = { userId: user, extension: false } as Actor;
beforeEach(() => {
  vi.stubEnv("APP_ENCRYPTION_KEY", "ab".repeat(32));
  vi.stubEnv("GITHUB_APP_ID", "1");
  vi.stubEnv(
    "GITHUB_PRIVATE_KEY_BASE64",
    Buffer.from("test-only-pem").toString("base64"),
  );
  vi.stubEnv("GITHUB_CLIENT_ID", "client");
  vi.stubEnv("GITHUB_CLIENT_SECRET", "test-only-secret");
  mocks.connection.mockResolvedValue({
    data: {
      installation_id: 5,
      encrypted_user_token: encrypt("test-user-token"),
    },
    error: null,
  });
  mocks.auth.mockResolvedValue({ token: "test-installation-token" });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});
const repo = {
  owner: { login: "owner" },
  name: "repo",
  full_name: "owner/repo",
  private: true,
};
describe("GitHub repository authorization and reconciliation", () => {
  it("lists only repositories from the users verified installation", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ repositories: [repo] })),
      );
    expect(await repositories(actor)).toEqual([
      { owner: "owner", name: "repo", fullName: "owner/repo", private: true },
    ]);
    expect(String(fetch.mock.calls[0][0])).toContain(
      "/user/installations/5/repositories",
    );
  });
  it("denies unlisted repository before minting any token", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ repositories: [repo] })),
    );
    await expect(
      authorizeRepo(actor, "other", "private"),
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.auth).not.toHaveBeenCalled();
  });
  it("narrows installation token permissions to the selected repository", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ repositories: [repo] })),
    );
    expect(await authorizeRepo(actor, "owner", "repo")).toBe(
      "test-installation-token",
    );
    expect(mocks.auth).toHaveBeenCalledWith({
      type: "installation",
      installationId: 5,
      repositoryNames: ["repo"],
      permissions: { issues: "write", metadata: "read" },
    });
  });
  it("fails closed when the user authorization expires", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 401 }),
    );
    await expect(authorizeRepo(actor, "owner", "repo")).rejects.toMatchObject({
      code: "github_error",
    });
    expect(mocks.auth).not.toHaveBeenCalled();
  });
  it("requires an existing connection", async () => {
    mocks.connection.mockResolvedValue({ data: null, error: null });
    await expect(repositories(actor)).rejects.toMatchObject({
      code: "github_not_connected",
    });
  });
  it("reconciles only a matching marker and ignores pull requests", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            number: 9,
            html_url: "https://github.com/owner/repo/pull/9",
            body: `<!-- devflow:${key} -->`,
            pull_request: {},
          },
          {
            number: 10,
            html_url: "https://github.com/owner/repo/issues/10",
            body: `<!-- devflow:${key} -->`,
          },
        ]),
      ),
    );
    expect((await reconcileRemote("token", "owner", "repo", key))?.number).toBe(
      10,
    );
  });
  it("keeps an absent remote marker unresolved", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("[]"));
    expect(await reconcileRemote("token", "owner", "repo", key)).toBeNull();
  });
});
