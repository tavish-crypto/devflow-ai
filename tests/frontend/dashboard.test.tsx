// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import Dashboard, { filterIssues } from "../../apps/web/src/app/ui";
import { issue } from "./fixtures";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("combines search, priority, status and repository filters", () => {
  const input = [
    issue,
    {
      ...issue,
      id: "other",
      status: "published" as const,
      report: {
        ...issue.report,
        title: "Docs typo",
        summary: "Documentation spelling correction",
        priority: "low" as const,
      },
    },
  ];
  expect(
    filterIssues(
      input,
      "checkout",
      "draft",
      "high",
      "tavish-crypto/devflow-ai",
    ),
  ).toEqual([issue]);
  expect(filterIssues(input, "checkout", "published", "", "")).toEqual([]);
});
it("renders reports returned by the real API client and filters them", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      Response.json(
        url.includes("repositories")
          ? { repositories: [] }
          : { issues: [issue] },
      ),
    ),
  );
  render(<Dashboard view="issues" />);
  expect(await screen.findByText(issue.report.title)).toBeTruthy();
  fireEvent.change(screen.getByRole("textbox", { name: "Search issues" }), {
    target: { value: "not present" },
  });
  expect(screen.queryByText(issue.report.title)).toBeNull();
  expect(screen.getByText(/Showing 0 of 1/)).toBeTruthy();
});
it("shows safe errors and an actionable retry when persistence is unavailable", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json(
        { code: "database_error", message: "Database operation failed" },
        { status: 503 },
      ),
    ),
  );
  render(<Dashboard />);
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Reload workspace" })).toBeTruthy();
  expect(screen.queryByText("0")).toBeNull();
});
