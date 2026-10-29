import { describe, it, expect, vi } from "vitest";
import { publish, type PublisherDeps } from "../../apps/web/src/lib/issues";
import {
  GithubFault,
  issueBody,
  heuristic,
  gh,
} from "../../apps/web/src/lib/github";
import type { Actor } from "../../apps/web/src/lib/supabase";
import { id, key, user, row, report } from "./fixtures";
const actor = { userId: user, extension: false } as Actor;
function deps(): PublisherDeps {
  return {
    claim: vi.fn().mockResolvedValue({
      claimed: true,
      issue: { ...row, status: "publishing" },
    }),
    finish: vi
      .fn()
      .mockImplementation(async (_u, _i, _k, status, number, url) => ({
        ...row,
        status,
        github_issue_number: number ?? null,
        github_url: url ?? null,
      })),
    authorize: vi.fn().mockResolvedValue("installation-token"),
    create: vi.fn().mockResolvedValue({
      number: 42,
      html_url: "https://github.com/owner/repo/issues/42",
    }),
  };
}
describe("publication state machine", () => {
  it("persists a successful GitHub creation", async () => {
    const d = deps();
    const result = await publish(actor, id, key, d);
    expect(result.remoteResult).toBe("created");
    expect(result.issue.status).toBe("published");
    expect(d.create).toHaveBeenCalledOnce();
  });
  it("returns an existing publication without recreating", async () => {
    const d = deps();
    vi.mocked(d.claim).mockResolvedValue({
      claimed: false,
      issue: {
        ...row,
        status: "published",
        github_issue_number: 42,
        github_url: "https://github.com/owner/repo/issues/42",
      },
    });
    expect((await publish(actor, id, key, d)).remoteResult).toBe("existing");
    expect(d.create).not.toHaveBeenCalled();
  });
  it("blocks concurrent publication", async () => {
    const d = deps();
    vi.mocked(d.claim).mockResolvedValue({
      claimed: false,
      issue: { ...row, status: "publishing" },
    });
    await expect(publish(actor, id, key, d)).rejects.toMatchObject({
      code: "publish_in_progress",
    });
    expect(d.create).not.toHaveBeenCalled();
  });
  it("never blindly retries unknown outcome", async () => {
    const d = deps();
    vi.mocked(d.claim).mockResolvedValue({
      claimed: false,
      issue: { ...row, status: "publish_unknown" },
    });
    expect((await publish(actor, id, key, d)).remoteResult).toBe("unknown");
    expect(d.create).not.toHaveBeenCalled();
  });
  it("preserves draft after denied repository authorization", async () => {
    const d = deps();
    vi.mocked(d.authorize).mockRejectedValue(new Error("denied"));
    const r = await publish(actor, id, key, d);
    expect(r.issue.status).toBe("failed");
    expect(r.issue.report).toEqual(report);
    expect(d.create).not.toHaveBeenCalled();
  });
  it("marks network timeout unknown", async () => {
    const d = deps();
    vi.mocked(d.create).mockRejectedValue(new GithubFault(502, true));
    expect((await publish(actor, id, key, d)).issue.status).toBe(
      "publish_unknown",
    );
  });
  it("marks permission denial failed", async () => {
    const d = deps();
    vi.mocked(d.create).mockRejectedValue(new GithubFault(403));
    expect((await publish(actor, id, key, d)).issue.status).toBe("failed");
  });
  it("retains draft on rate limit", async () => {
    const d = deps();
    vi.mocked(d.create).mockRejectedValue(new GithubFault(429));
    expect((await publish(actor, id, key, d)).issue.status).toBe("failed");
  });
  it("marks database failure after remote creation unknown", async () => {
    const d = deps();
    vi.mocked(d.finish).mockRejectedValueOnce(new Error("db"));
    expect((await publish(actor, id, key, d)).remoteResult).toBe("unknown");
  });
  it("marks malformed remote acknowledgement unknown", async () => {
    const d = deps();
    vi.mocked(d.create).mockResolvedValue({
      number: NaN,
      html_url: "javascript:alert(1)",
    });
    expect((await publish(actor, id, key, d)).remoteResult).toBe("unknown");
  });
  it("escapes untrusted markup and mentions, adds reconciliation marker", () => {
    const body = issueBody(
      { ...report, summary: "<script>x</script> @team" },
      key,
    );
    expect(body).not.toContain("<script>");
    expect(body).not.toContain("@team");
    expect(body).toContain(`<!-- devflow:${key} -->`);
  });
  it("labels a bounded lexical duplicate heuristic", () => {
    expect(heuristic("Checkout error", "Checkout error")).toBe(1);
    expect(heuristic("Different subject", "Checkout error")).toBe(0);
  });
  it("does not retry a GitHub POST after network failure", async () => {
    const mock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("network"));
    await expect(
      gh("/repos/a/b/issues", "x", { method: "POST" }),
    ).rejects.toMatchObject({ uncertain: true });
    expect(mock).toHaveBeenCalledOnce();
    mock.mockRestore();
  });
  it("recognizes GitHub rate limit responses", async () => {
    const mock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", {
        status: 403,
        headers: { "x-ratelimit-remaining": "0" },
      }),
    );
    await expect(gh("/user", "x")).rejects.toMatchObject({ status: 429 });
    mock.mockRestore();
  });
});
