import { watchPageErrors, assertNoPageErrors } from "./helpers";
import { test, expect } from "@playwright/test";
import { issue } from "../frontend/fixtures";
import {
  signIn,
  mockApi,
  assertNoHorizontalOverflow,
  labelDemo,
} from "./helpers";
test("mobile landing and workspace remain readable and navigable", async ({
  context,
  page,
}) => {
  await page.goto("/");
  await assertNoHorizontalOverflow(page);
  await signIn(context);
  await mockApi(context);
  await page.goto("/dashboard");
  await expect(page.getByText(issue.report.title)).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("link", { name: "Issues", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/issues$/);
  await assertNoHorizontalOverflow(page);
  await page.goto(`/dashboard/issues/${issue.id}`);
  await expect(page.getByText("Observed selection")).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await labelDemo(page);
  await page.screenshot({
    path: "docs/screenshots/mobile-demo.png",
    fullPage: true,
  });
});

test.beforeEach(async ({ page }) => {
  watchPageErrors(page);
});
test.afterEach(async ({ page }) => {
  assertNoPageErrors(page);
});
