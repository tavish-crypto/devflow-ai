import { z } from "zod";
import {
  CaptureInputSchema,
  IssueReportSchema,
  IssueSchema,
} from "@devflow/contracts";
export const LocalDraftSchema = z.object({
  id: z.uuid(),
  capture: CaptureInputSchema,
  report: IssueReportSchema.nullable(),
  issue: IssueSchema.nullable(),
  mode: z.string(),
});
export const LocalDraftsSchema = z.array(LocalDraftSchema).max(10);
export type LocalDraft = z.infer<typeof LocalDraftSchema>;
export function preserveDraft(
  drafts: LocalDraft[],
  snapshot: Omit<LocalDraft, "id">,
): LocalDraft[] {
  if (!CaptureInputSchema.safeParse(snapshot.capture).success) return drafts;
  const serialized = JSON.stringify(snapshot);
  const unique = drafts.filter(
    (d) =>
      JSON.stringify({
        capture: d.capture,
        report: d.report,
        issue: d.issue,
        mode: d.mode,
      }) !== serialized,
  );
  return [{ ...snapshot, id: crypto.randomUUID() }, ...unique].slice(0, 10);
}
