import { z } from "zod";
export const CaptureInputSchema = z
  .object({
    pageTitle: z.string().max(500),
    url: z
      .url()
      .max(2048)
      .refine(
        (v) =>
          URL.canParse(v) && ["http:", "https:"].includes(new URL(v).protocol),
        "HTTP(S) URL required",
      ),
    selectedText: z.string().min(1).max(16000),
    userNotes: z.string().max(4000).optional(),
    capturedAt: z.iso.datetime(),
  })
  .strict();
export const IssueReportSchema = z
  .object({
    title: z.string().min(1).max(200),
    summary: z.string().max(4000),
    issueType: z.enum(["bug", "task", "docs"]),
    priority: z.enum(["low", "medium", "high"]),
    actualBehavior: z.string().max(4000).nullable(),
    expectedBehavior: z.string().max(4000).nullable(),
    reproductionSteps: z.array(z.string().max(1000)).max(20),
    possibleCause: z.string().max(2000).nullable(),
    suggestedFix: z.string().max(2000).nullable(),
    missingInformation: z.array(z.string().max(1000)).max(30),
    evidence: z
      .array(
        z
          .object({
            kind: z.string().max(50),
            content: z.string().max(16000),
            source: z.enum(["observed", "user"]),
          })
          .strict(),
      )
      .max(30),
    aiFields: z.array(z.string().max(50)).max(20),
  })
  .strict();
export const IssueStatusSchema = z.enum([
  "draft",
  "publishing",
  "published",
  "publish_unknown",
  "failed",
]);
export const IssueSchema = z
  .object({
    id: z.uuid(),
    status: IssueStatusSchema,
    report: IssueReportSchema,
    repoOwner: z.string().optional(),
    repoName: z.string().optional(),
    githubIssueNumber: z.number().int().positive().optional(),
    githubUrl: z.url().optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export const AnalyzeRequestSchema = z
  .object({ capture: CaptureInputSchema, consent: z.literal(true) })
  .strict();
export const AnalyzeResponseSchema = z.object({
  report: IssueReportSchema,
  mode: z.enum(["ai", "fallback"]),
});
const repoPart = z.string().regex(/^[a-zA-Z0-9_.-]{1,100}$/);
export const CreateIssueSchema = z
  .object({
    report: IssueReportSchema,
    capture: CaptureInputSchema,
    repoOwner: repoPart.optional(),
    repoName: repoPart.optional(),
  })
  .strict()
  .refine(
    (v) => !!v.repoOwner === !!v.repoName,
    "Both repository fields are required together",
  );
export const PatchIssueSchema = z
  .object({
    report: IssueReportSchema.optional(),
    repoOwner: repoPart.optional(),
    repoName: repoPart.optional(),
  })
  .strict()
  .refine(
    (v) => !!v.repoOwner === !!v.repoName,
    "Both repository fields are required together",
  );
export const PublishRequestSchema = z
  .object({ idempotencyKey: z.uuid(), confirmed: z.literal(true) })
  .strict();
export const ErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  requestId: z.string().optional(),
});
export const PairingStartSchema = z.object({}).strict();
export const PairingConfirmSchema = z
  .object({
    code: z.string().regex(/^[A-F0-9]{8}$/),
    confirmed: z.literal(true),
  })
  .strict();
export const PairingStatusSchema = z
  .object({
    pairingId: z.uuid(),
    pollingSecret: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  })
  .strict();
export const PairingRevokeSchema = z.object({ sessionId: z.uuid() }).strict();
export const RepositorySchema = z.object({
  owner: z.string(),
  name: z.string(),
  fullName: z.string(),
  private: z.boolean(),
});
export const DuplicateSchema = z.object({
  number: z.number().int(),
  title: z.string(),
  url: z.url(),
  state: z.string(),
  score: z.number().min(0).max(1),
});
export type CaptureInput = z.infer<typeof CaptureInputSchema>;
export type IssueReport = z.infer<typeof IssueReportSchema>;
export type Issue = z.infer<typeof IssueSchema>;
export type Repository = z.infer<typeof RepositorySchema>;
export type ApiError = z.infer<typeof ErrorSchema>;
export const IssuesResponseSchema = z.object({ issues: z.array(IssueSchema) });
export const IssueResponseSchema = z.object({ issue: IssueSchema });
export const PublishResponseSchema = z.object({
  issue: IssueSchema,
  remoteResult: z.enum(["created", "existing", "unknown", "failed"]),
});
export const RepositoriesResponseSchema = z.object({
  repositories: z.array(RepositorySchema),
});
export const DuplicatesResponseSchema = z.object({
  candidates: z.array(DuplicateSchema),
});

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  version: z.literal(1),
  integrations: z.object({
    supabase: z.boolean(),
    gemini: z.boolean(),
    github: z.boolean(),
  }),
});
export const PairingStartResponseSchema = z.object({
  pairingId: z.uuid(),
  code: z.string().regex(/^[A-F0-9]{8}$/),
  pollingSecret: z.string().length(43),
  expiresAt: z.iso.datetime(),
});
export const PairingStatusResponseSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("pending") }),
  z.object({
    status: z.literal("approved"),
    sessionId: z.uuid(),
    expiresAt: z.iso.datetime(),
    token: z.string().regex(/^df_[A-Za-z0-9_-]{43}$/),
    scopes: z.array(z.enum(["analyze", "issues:read", "issues:write"])),
  }),
]);
export const ReconcileRequestSchema = z
  .object({ confirmed: z.literal(true) })
  .strict();
