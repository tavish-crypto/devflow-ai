import { describe, it, expect } from "vitest";
import {
  AnalyzeRequestSchema,
  CaptureInputSchema,
  IssueSchema,
  IssueReportSchema,
  PublishRequestSchema,
  CreateIssueSchema,
  PairingConfirmSchema,
} from "@devflow/contracts";
import { capture, report, id, key } from "./fixtures";
describe("frozen contracts", () => {
  it("accepts a bounded capture", () =>
    expect(CaptureInputSchema.parse(capture)).toEqual(capture));
  it.each([undefined, false, null])("requires consent %s", (consent) =>
    expect(AnalyzeRequestSchema.safeParse({ capture, consent }).success).toBe(
      false,
    ),
  );
  it.each(["file:///etc/passwd", "javascript:alert(1)", "http://"])(
    "rejects unsafe URL %s",
    (url) =>
      expect(CaptureInputSchema.safeParse({ ...capture, url }).success).toBe(
        false,
      ),
  );
  it("bounds selection size", () =>
    expect(
      CaptureInputSchema.safeParse({
        ...capture,
        selectedText: "x".repeat(16001),
      }).success,
    ).toBe(false));
  it("rejects invalid dates", () =>
    expect(
      CaptureInputSchema.safeParse({ ...capture, capturedAt: "yesterday" })
        .success,
    ).toBe(false));
  it("rejects injected user identity", () =>
    expect(
      AnalyzeRequestSchema.safeParse({ capture, consent: true, userId: id })
        .success,
    ).toBe(false));
  it("accepts unknown report fields as null", () =>
    expect(IssueReportSchema.parse(report).actualBehavior).toBeNull());
  it("rejects tool requests in report schema", () =>
    expect(
      IssueReportSchema.safeParse({ ...report, tools: ["shell"] }).success,
    ).toBe(false));
  it("requires explicit publication confirmation", () =>
    expect(
      PublishRequestSchema.safeParse({ idempotencyKey: key }).success,
    ).toBe(false));
  it("requires UUID idempotency key", () =>
    expect(
      PublishRequestSchema.safeParse({ idempotencyKey: "123", confirmed: true })
        .success,
    ).toBe(false));
  it("requires paired repository fields", () =>
    expect(
      CreateIssueSchema.safeParse({ capture, report, repoOwner: "owner" })
        .success,
    ).toBe(false));
  it("rejects path injection in repository names", () =>
    expect(
      CreateIssueSchema.safeParse({
        capture,
        report,
        repoOwner: "owner",
        repoName: "repo/../evil",
      }).success,
    ).toBe(false));
  it("requires explicit pairing confirmation", () =>
    expect(PairingConfirmSchema.safeParse({ code: "ABCDEF12" }).success).toBe(
      false,
    ));
  it.each(["draft", "publishing", "published", "publish_unknown", "failed"])(
    "preserves status %s",
    (status) =>
      expect(
        IssueSchema.safeParse({
          id,
          status,
          report,
          createdAt: capture.capturedAt,
          updatedAt: capture.capturedAt,
        }).success,
      ).toBe(true),
  );
});
