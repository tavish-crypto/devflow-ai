import { watchPageErrors, assertNoPageErrors } from "./helpers";
import { test, expect, chromium } from "@playwright/test";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { mockApi, signIn, labelDemo } from "./helpers";
const extension = path.resolve("apps/extension/.output/chrome-mv3");
type ExtensionStorage = {
  get: (key: string) => Promise<Record<string, unknown>>;
  set: (value: Record<string, unknown>) => Promise<void>;
};
type ExtensionApi = {
  storage: { local: ExtensionStorage; session: ExtensionStorage };
  runtime: { sendMessage: (message: unknown) => Promise<unknown> };
  tabs: {
    update: (id: number, properties: { active: boolean }) => Promise<void>;
    query: (query: { url: string }) => Promise<{ id: number }[]>;
  };
};
test("MV3 manifest requests narrow permissions and has no conflicting popup", async () => {
  const manifest = JSON.parse(
    await readFile(path.join(extension, "manifest.json"), "utf8"),
  );
  expect(manifest.manifest_version).toBe(3);
  expect(manifest.permissions.sort()).toEqual(
    ["activeTab", "scripting", "sidePanel", "storage"].sort(),
  );
  expect(manifest.action.default_popup).toBeUndefined();
  expect(manifest.host_permissions).toEqual(["http://localhost:3000/*"]);
  expect(manifest.side_panel.default_path).toBe("sidepanel.html");
  expect(manifest.content_scripts).toBeUndefined();
});
test("unpacked extension pairing, actual selected-text capture, analysis, persistence and dashboard handoff", async () => {
  const context = await chromium.launchPersistentContext("", {
    channel: process.env.DEVFLOW_TEST_CHANNEL || "chromium",
    headless: true,
    executablePath: process.env.DEVFLOW_TEST_EXECUTABLE_PATH,
    viewport: { width: 380, height: 850 },
    reducedMotion: "reduce",
    ignoreDefaultArgs: ["--disable-extensions"],
    args: ["--enable-unsafe-extension-debugging"],
  });
  try {
    await signIn(context);
    const state = await mockApi(context, []);
    const cdp = await context.browser()!.newBrowserCDPSession();
    const loaded = await cdp.send("Extensions.loadUnpacked", {
      path: extension,
    });
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent("serviceworker");
    const extensionId = new URL(worker.url()).hostname;
    expect(extensionId).toBe(loaded.id);
    const panel = await context.newPage();
    watchPageErrors(panel);
    await panel.goto(`chrome-extension://${extensionId}/sidepanel.html`);
    await panel.getByRole("button", { name: /Connect your workspace/ }).click();
    await expect(panel.getByText("A1B2C3D4", { exact: true })).toBeVisible();
    const popup = context.waitForEvent("page");
    await panel.getByRole("button", { name: "Open pairing approval" }).click();
    const approval = await popup;
    watchPageErrors(approval);
    await approval.waitForLoadState();
    await approval.getByLabel("Extension pairing code").fill("A1B2C3D4");
    await approval.getByRole("button", { name: "Review connection" }).click();
    await approval.getByRole("button", { name: "Approve connection" }).click();
    await expect(
      approval.getByRole("heading", { name: "You’re connected." }),
    ).toBeVisible();
    await panel.getByRole("button", { name: /I approved/ }).click();
    await expect(
      panel.getByRole("button", { name: "Capture issue", exact: true }),
    ).toBeVisible();
    const demo = await context.newPage();
    watchPageErrors(demo);
    await demo.goto("http://127.0.0.1:3000/demo");
    await demo.getByRole("button", { name: "Checkout", exact: true }).click();
    await demo.getByTestId("demo-error").evaluate((node) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      const selection = window.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
    });
    const demoCdp = await context.newCDPSession(demo);
    await demoCdp.send("ServiceWorker.enable");
    const { targetInfos } = await cdp.send("Target.getTargets", {
      filter: [{ type: "tab", exclude: false }],
    });
    const tabTarget = targetInfos.find(
      (t) => t.type === "tab" && t.url === demo.url(),
    );
    expect(tabTarget, JSON.stringify(targetInfos)).toBeDefined();
    await cdp.send("Extensions.triggerAction", {
      id: extensionId,
      targetId: tabTarget!.targetId,
    });
    await expect(panel.getByLabel(/Selected evidence/)).toContainText(
      "TypeError",
    );
    await expect(
      panel.getByRole("button", { name: "Build my ProofPack" }),
    ).toBeDisabled();
    await panel.getByRole("checkbox").check();
    await panel.getByRole("button", { name: "Build my ProofPack" }).click();
    await expect(panel.getByText("Observed selection")).toBeVisible();
    await panel
      .getByLabel(/Issue title/)
      .fill("Extension captured empty-cart failure");
    await demoCdp.send("ServiceWorker.stopAllWorkers");
    await panel.reload();
    await expect(panel.getByLabel(/Issue title/)).toHaveValue(
      "Extension captured empty-cart failure",
    );
    await panel
      .getByRole("button", { name: "Save draft", exact: true })
      .click();
    await expect(
      panel.getByRole("button", { name: /Review & publish in dashboard/ }),
    ).toBeEnabled();
    expect(state.analyzes).toBe(1);
    const local = await panel.evaluate(() =>
      (
        globalThis as unknown as { chrome: ExtensionApi }
      ).chrome.storage.local.get("session"),
    );
    expect(local.session).toBeUndefined();
    await labelDemo(panel);
    await panel.screenshot({
      path: "docs/screenshots/extension-demo.png",
      fullPage: true,
    });
    const newPage = context.waitForEvent("page");
    await panel
      .getByRole("button", { name: /Review & publish in dashboard/ })
      .click();
    const dashboard = await newPage;
    await dashboard.waitForLoadState();
    await expect(
      dashboard.getByRole("heading", {
        name: "Extension captured empty-cart failure",
      }),
    ).toBeVisible();
    const saved = state.issues[0];
    state.issues = [
      {
        ...saved,
        status: "published",
        githubIssueNumber: 42,
        githubUrl: "https://github.com/tavish-crypto/devflow-ai/issues/42",
      },
    ];
    await panel
      .getByRole("button", { name: "Refresh publication status" })
      .click();
    await expect(
      panel.getByRole("link", { name: "Open GitHub issue #42" }),
    ).toHaveAttribute(
      "href",
      "https://github.com/tavish-crypto/devflow-ai/issues/42",
    );
    assertNoPageErrors(panel);
    assertNoPageErrors(demo);
    assertNoPageErrors(approval);
  } finally {
    await context.close();
  }
});
