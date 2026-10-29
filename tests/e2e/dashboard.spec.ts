import { watchPageErrors, assertNoPageErrors } from "./helpers";
import { test, expect } from "@playwright/test";
import { issue } from "../frontend/fixtures";
import {
  mockApi,
  signIn,
  assertNoHorizontalOverflow,
  labelDemo,
} from "./helpers";
import { mkdir } from "node:fs/promises";
test("unauthenticated dashboard and pairing are guarded", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/connect-extension");
  await expect(page).toHaveURL(/\/login$/);
});
test("landing, login and demo are functional and captureable", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Great bug reports/ }),
  ).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await mkdir("docs/screenshots", { recursive: true });
  await labelDemo(page);
  await page.screenshot({
    path: "docs/screenshots/landing.png",
    fullPage: true,
  });
  await page.goto("/demo");
  await page.getByRole("button", { name: "Checkout", exact: true }).click();
  await expect(page.getByTestId("demo-error")).toContainText("TypeError");
  await page.getByRole("button", { name: "Reset demo" }).click();
  await expect(page.getByTestId("demo-error")).toHaveCount(0);
});
test("capture consent, validated analysis, edit, save, duplicates, confirmation and one publication", async ({
  context,
  page,
}) => {
  await signIn(context);
  const state = await mockApi(context, []);
  await page.goto("/dashboard/new");
  await page.getByLabel("Page title").fill("Demo checkout");
  await page.getByLabel("Source URL").fill("https://example.com/cart");
  await page.getByLabel(/Selected evidence/).fill("TypeError: cart is empty");
  await expect(
    page.getByRole("button", { name: "Build my ProofPack" }),
  ).toBeDisabled();
  expect(state.analyzes).toBe(0);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Build my ProofPack" }).click();
  await expect(page.getByText("Observed selection")).toBeVisible();
  await page.getByLabel(/Issue title/).fill("Empty cart crashes checkout");
  await page
    .getByLabel(/Expected behavior/)
    .fill("Explain that the cart is empty.");
  await page
    .getByRole("button", { name: "Save draft & review publication" })
    .click();
  await expect(page).toHaveURL(new RegExp(issue.id));
  await page
    .getByLabel("Repository", { exact: true })
    .selectOption("tavish-crypto/devflow-ai");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Check possible duplicates" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Check possible duplicates" }).click();
  await expect(page.getByText("Possible match")).toBeVisible();
  await page.getByRole("checkbox", { name: /this report is distinct/ }).check();
  await page.getByRole("button", { name: "Review & publish" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(state.publishes).toBe(0);
  await page
    .getByRole("button", { name: "Publish to GitHub", exact: true })
    .evaluate((button) => {
      button.click();
      button.click();
    });
  await expect(
    page.getByRole("link", { name: "Open on GitHub" }),
  ).toHaveAttribute("href", /\/issues\/42$/);
  expect(state.publishes).toBe(1);
  await page.goto("/dashboard");
  await expect(page.getByText("Empty cart crashes checkout")).toBeVisible();
  await expect(page.getByText("published", { exact: true })).toBeVisible();
  await assertNoHorizontalOverflow(page);
});
test("overview screenshots use explicitly mocked demonstration reports", async ({
  context,
  page,
}) => {
  await signIn(context);
  await mockApi(context);
  await page.goto("/dashboard");
  await expect(page.getByText(issue.report.title)).toBeVisible();
  await labelDemo(page);
  await page.screenshot({
    path: "docs/screenshots/dashboard-demo.png",
    fullPage: true,
  });
  await page.goto(`/dashboard/issues/${issue.id}`);
  await expect(page.getByText("Observed selection")).toBeVisible();
  await labelDemo(page);
  await page.screenshot({
    path: "docs/screenshots/proofpack-demo.png",
    fullPage: true,
  });
});
test("draft edits recover after reload and filtering works", async ({
  context,
  page,
}) => {
  await signIn(context);
  await mockApi(context);
  await page.goto(`/dashboard/issues/${issue.id}`);
  await page.getByLabel(/Issue title/).fill("Recovered local title");
  page.on("dialog", (d) => d.accept());
  await page.reload();
  await expect(page.getByLabel(/Issue title/)).toHaveValue(
    "Recovered local title",
  );
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page.goto("/dashboard/issues");
  await page.getByRole("textbox", { name: "Search issues" }).fill("not found");
  await expect(page.getByText(/Showing 0 of 1/)).toBeVisible();
});
test("publishing timeout blocks retries and requires reload", async ({
  context,
  page,
}) => {
  await signIn(context);
  const state = await mockApi(context);
  await context.route("**/api/v1/issues/*/publish", (r) => r.abort("timedout"));
  await page.goto(`/dashboard/issues/${issue.id}`);
  await page.getByRole("button", { name: "Check possible duplicates" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Review & publish" }).click();
  await page
    .getByRole("button", { name: "Publish to GitHub", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reload server state" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review & publish" }),
  ).toBeDisabled();
  expect(state.publishes).toBe(0);
});

test.beforeEach(async ({ page }) => {
  watchPageErrors(page);
});
test.afterEach(async ({ page }) => {
  assertNoPageErrors(page);
});
