import { expect, it } from "vitest";
import { preserveDraft } from "../../apps/extension/src/workspace";
import { capture, report } from "./fixtures";
it("preserves displaced capture drafts without duplicate snapshots", () => {
  const snapshot = { capture, report, issue: null, mode: "ai" };
  const first = preserveDraft([], snapshot);
  expect(first[0].report).toEqual(report);
  expect(preserveDraft(first, snapshot)).toHaveLength(1);
});
it("bounds local history and ignores invalid empty captures", () => {
  let drafts = preserveDraft([], { capture, report, issue: null, mode: "ai" });
  for (let n = 0; n < 15; n++)
    drafts = preserveDraft(drafts, {
      capture: { ...capture, selectedText: String(n) },
      report,
      issue: null,
      mode: "ai",
    });
  expect(drafts).toHaveLength(10);
  expect(drafts[0].capture.selectedText).toBe("14");
  expect(
    preserveDraft(drafts, {
      capture: { ...capture, selectedText: "" },
      report: null,
      issue: null,
      mode: "",
    }),
  ).toEqual(drafts);
});
