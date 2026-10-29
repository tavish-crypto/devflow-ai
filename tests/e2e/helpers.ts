import { expect, type BrowserContext, type Page } from "@playwright/test";
import { issue, report } from "../frontend/fixtures";
import type { Issue } from "@devflow/contracts";
export const userId = "00000000-0000-4000-8000-000000000001";
export async function signIn(context: BrowserContext) {
  const payload = Buffer.from(
    JSON.stringify({
      exp: Math.floor(Date.now() / 1000) + 3600,
      sub: userId,
      aud: "authenticated",
    }),
  ).toString("base64url");
  const session = {
    access_token: `e30.${payload}.test-signature`,
    refresh_token: "fixture-refresh",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: "bearer",
    user: { id: userId, email: "demo@example.test" },
  };
  await context.addCookies([
    {
      name: "sb-127-auth-token",
      value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
export async function mockApi(
  context: BrowserContext,
  initial: Issue[] = [structuredClone(issue)],
) {
  const state = { issues: initial, publishes: 0, analyzes: 0, approved: false };
  await context.route("**/api/v1/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname.replace("/api/v1/", ""),
      body =
        req.method() === "POST" || req.method() === "PATCH"
          ? req.postDataJSON()
          : undefined;
    const json = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": req.headers().origin || "*" },
        body: JSON.stringify(data),
      });
    if (req.method() === "OPTIONS")
      return route.fulfill({
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": req.headers().origin || "*",
          "Access-Control-Allow-Headers": "Content-Type,Authorization",
          "Access-Control-Allow-Methods": "GET,POST,PATCH",
        },
      });
    if (path === "github/repositories")
      return json({
        repositories: [
          {
            owner: "tavish-crypto",
            name: "devflow-ai",
            fullName: "tavish-crypto/devflow-ai",
            private: false,
          },
        ],
      });
    if (path === "github/duplicates")
      return json({
        candidates: [
          {
            number: 8,
            title: "Checkout total has an error",
            url: "https://github.com/tavish-crypto/devflow-ai/issues/8",
            state: "open",
            score: 0.2,
          },
        ],
      });
    if (path === "account")
      return json({
        email: "demo@example.test",
        sessions: [],
        githubConnected: true,
      });
    if (path === "analyze") {
      state.analyzes++;
      expect(body.consent).toBe(true);
      return json({
        report: {
          ...report,
          evidence: [
            {
              kind: "selection",
              source: "observed",
              content: body.capture.selectedText,
            },
          ],
        },
        mode: "ai",
      });
    }
    if (path === "issues" && req.method() === "GET")
      return json({ issues: state.issues });
    if (path === "issues" && req.method() === "POST") {
      const next = {
        id: issue.id,
        status: "draft" as const,
        report: body.report,
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
        ...(body.repoOwner
          ? { repoOwner: body.repoOwner, repoName: body.repoName }
          : {}),
      };
      state.issues = [next];
      return json({ issue: next });
    }
    if (path.startsWith("issues/")) {
      let next = state.issues.find((i) => i.id === path.split("/")[1]);
      if (!next)
        return json({ code: "not_found", message: "Issue not found" }, 404);
      if (path.endsWith("/publish")) {
        state.publishes++;
        expect(body).toEqual({ idempotencyKey: next.id, confirmed: true });
        await new Promise((r) => setTimeout(r, 200));
        next = {
          ...next,
          status: "published",
          githubUrl: "https://github.com/tavish-crypto/devflow-ai/issues/42",
          githubIssueNumber: 42,
        };
      } else if (req.method() === "PATCH")
        next = { ...next, ...body, updatedAt: new Date().toISOString() };
      state.issues = state.issues.map((i) => (i.id === next!.id ? next! : i));
      return json(
        path.endsWith("/publish")
          ? { issue: next, remoteResult: "created" }
          : { issue: next },
      );
    }
    if (path === "pairing/start")
      return json({
        pairingId: issue.id,
        code: "A1B2C3D4",
        pollingSecret: "a".repeat(43),
        expiresAt: new Date(Date.now() + 300000).toISOString(),
      });
    if (path === "pairing/confirm") {
      state.approved = true;
      return json({ pairingId: issue.id, status: "approved" });
    }
    if (path === "pairing/status")
      return json(
        state.approved
          ? {
              status: "approved",
              sessionId: issue.id,
              expiresAt: new Date(Date.now() + 3600000).toISOString(),
              token: "df_" + "a".repeat(43),
              scopes: ["analyze", "issues:read", "issues:write"],
            }
          : { status: "pending" },
      );
    return json(
      { code: "not_found", message: "Test endpoint not stubbed" },
      404,
    );
  });
  return state;
}
export async function assertNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
}
export async function labelDemo(page: Page) {
  await page.evaluate(() => {
    const label = document.createElement("div");
    label.textContent = "DEMO DATA · MOCKED SERVICES";
    label.style.cssText =
      "position:fixed;bottom:8px;left:8px;z-index:999;background:#151d30;color:#a8b4cf;border:1px solid #8b7cff44;border-radius:5px;padding:5px 9px;font:10px monospace";
    document.body.appendChild(label);
  });
}
const pageErrors = new WeakMap<Page, string[]>();
export function watchPageErrors(page: Page) {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on("pageerror", (e) => errors.push(e.message));
}
export function assertNoPageErrors(page: Page) {
  expect(pageErrors.get(page) ?? []).toEqual([]);
}
