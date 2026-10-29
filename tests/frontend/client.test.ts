import { afterEach, describe, expect, it, vi } from "vitest";
import { createApi, messageOf } from "../../packages/product/src/api";
import { capture, issue, report } from "./fixtures";
const transport = vi.fn<typeof fetch>();
const client = createApi("https://app.test", "df_scoped", transport);
afterEach(() => vi.resetAllMocks());
describe("validated API client", () => {
  it("sends only explicit consent with scoped bearer auth and no cookies", async () => {
    transport.mockResolvedValue(Response.json({ report, mode: "ai" }));
    await client.analyze({ capture, consent: true });
    expect(transport).toHaveBeenCalledWith(
      "https://app.test/api/v1/analyze",
      expect.objectContaining({
        credentials: "omit",
        headers: expect.objectContaining({ Authorization: "Bearer df_scoped" }),
        body: JSON.stringify({ capture, consent: true }),
        signal: expect.any(AbortSignal),
      }),
    );
  });
  it("rejects invalid captures before sending anything", async () => {
    expect(() =>
      client.analyze({
        capture: { ...capture, url: "file:///private" },
        consent: true,
      }),
    ).toThrow();
    expect(transport).not.toHaveBeenCalled();
  });
  it("validates server response shapes", async () => {
    transport.mockResolvedValue(Response.json({ report: {}, mode: "ai" }));
    await expect(
      client.analyze({ capture, consent: true }),
    ).rejects.toMatchObject({ code: "invalid_response" });
  });
  it("rejects unreadable successful responses", async () => {
    transport.mockResolvedValue(new Response("not json"));
    await expect(client.issues()).rejects.toMatchObject({
      code: "invalid_response",
    });
  });
  it.each([401, 403, 429, 503])(
    "preserves safe structured %s errors",
    async (status) => {
      transport.mockResolvedValue(
        Response.json({ code: "safe_error", message: "Try again" }, { status }),
      );
      await expect(client.issues()).rejects.toMatchObject({
        status,
        code: "safe_error",
        message: "Try again",
      });
    },
  );
  it("never displays arbitrary upstream error content", async () => {
    transport.mockResolvedValue(
      Response.json({ private: "sensitive" }, { status: 500 }),
    );
    await expect(client.issues()).rejects.toMatchObject({
      message: "Request failed. Please try again.",
    });
  });
  it("does not retry publication on network failure", async () => {
    transport.mockRejectedValue(new DOMException("timeout", "TimeoutError"));
    await expect(client.publish(issue.id)).rejects.toMatchObject({
      code: "network_error",
    });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("uses the issue UUID for a stable publication key across client instances", async () => {
    transport.mockImplementation(async () =>
      Response.json({
        issue: {
          ...issue,
          status: "published",
          githubUrl: "https://github.com/tavish-crypto/devflow-ai/issues/1",
          githubIssueNumber: 1,
        },
        remoteResult: "created",
      }),
    );
    await client.publish(issue.id);
    await createApi("https://app.test", undefined, transport).publish(issue.id);
    const bodies = transport.mock.calls.map((c) =>
      JSON.parse(c[1]!.body as string),
    );
    expect(bodies).toEqual([
      { confirmed: true, idempotencyKey: issue.id },
      { confirmed: true, idempotencyKey: issue.id },
    ]);
  });
  it("cancels pending reads on navigation", async () => {
    const c = new AbortController();
    transport.mockImplementation(async (_url, options) => {
      c.abort();
      throw options?.signal?.reason;
    });
    await expect(client.issues(c.signal)).rejects.toBeDefined();
    expect(transport.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });
  it("validates pairing codes and session revocation IDs", () => {
    expect(() => client.confirmPairing("invalid")).toThrow();
    expect(() => client.revoke("oops")).toThrow();
    expect(transport).not.toHaveBeenCalled();
  });
  it("encodes duplicate queries as data", async () => {
    transport.mockResolvedValue(Response.json({ candidates: [] }));
    await client.duplicates("owner", "repo", "x & repo:private");
    const url = new URL(transport.mock.calls[0][0] as string);
    expect(url.searchParams.get("title")).toBe("x & repo:private");
  });
  it("does not reveal unknown exceptions", () =>
    expect(messageOf(new Error("secret"))).not.toContain("secret"));
});
