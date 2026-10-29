import { fallback } from "../../apps/web/src/lib/ai";
import type { IssueRow } from "../../apps/web/src/lib/issues";
export const user = "00000000-0000-4000-8000-000000000001";
export const id = "00000000-0000-4000-8000-000000000002";
export const key = "00000000-0000-4000-8000-000000000003";
export const capture = {
  pageTitle: "Checkout failure",
  url: "https://example.com/checkout",
  selectedText: "Checkout shows an error.",
  userNotes: "Observed in Firefox.",
  capturedAt: "2026-10-29T10:00:00.000Z",
};
export const report = fallback(capture);
export const row: IssueRow = {
  id,
  user_id: user,
  status: "draft",
  report,
  repo_owner: "owner",
  repo_name: "repo",
  github_issue_number: null,
  github_url: null,
  idempotency_key: null,
  created_at: capture.capturedAt,
  updated_at: capture.capturedAt,
};
