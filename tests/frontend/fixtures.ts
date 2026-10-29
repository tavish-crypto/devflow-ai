import type { CaptureInput, Issue, IssueReport } from "@devflow/contracts";
export const capture: CaptureInput = {
  pageTitle: "Demo checkout",
  url: "https://example.com/cart",
  selectedText: "TypeError: cart is empty",
  userNotes: "Pressed checkout without adding items.",
  capturedAt: "2026-10-29T10:00:00.000Z",
};
export const report: IssueReport = {
  title: "Checkout fails with an empty cart",
  summary: "The checkout displays an error.",
  issueType: "bug",
  priority: "high",
  actualBehavior: "An error appears",
  expectedBehavior: null,
  reproductionSteps: [],
  possibleCause: null,
  suggestedFix: null,
  missingInformation: ["Confirm expected behavior"],
  evidence: [
    { kind: "selection", content: capture.selectedText, source: "observed" },
    { kind: "note", content: capture.userNotes!, source: "user" },
  ],
  aiFields: ["title", "summary", "priority", "actualBehavior"],
};
export const issue: Issue = {
  id: "00000000-0000-4000-8000-000000000002",
  status: "draft",
  report,
  repoOwner: "tavish-crypto",
  repoName: "devflow-ai",
  createdAt: capture.capturedAt,
  updatedAt: capture.capturedAt,
};
