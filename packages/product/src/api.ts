import { z } from "zod";
import {
  AnalyzeRequestSchema,
  AnalyzeResponseSchema,
  CreateIssueSchema,
  PatchIssueSchema,
  IssueResponseSchema,
  IssuesResponseSchema,
  PublishRequestSchema,
  PublishResponseSchema,
  RepositoriesResponseSchema,
  DuplicatesResponseSchema,
  PairingStartResponseSchema,
  PairingStatusSchema,
  PairingStatusResponseSchema,
  PairingConfirmSchema,
  PairingRevokeSchema,
  ReconcileRequestSchema,
  ErrorSchema,
  AccountResponseSchema,
  DisconnectRequestSchema,
  DisconnectResponseSchema,
} from "@devflow/contracts";

export class ClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}
export function createApi(base = "", token?: string, transport?: typeof fetch) {
  async function request<T>(
    path: string,
    schema: z.ZodType<T>,
    body?: unknown,
    method = body === undefined ? "GET" : "POST",
    signal?: AbortSignal,
  ): Promise<T> {
    let response: Response;
    try {
      response = await (transport ?? fetch)(`${base}/api/v1/${path}`, {
        method,
        credentials: token ? "omit" : "same-origin",
        cache: "no-store",
        headers: {
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
          : AbortSignal.timeout(15000),
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new ClientError(
        "network_error",
        "Connection interrupted or timed out. Reload the saved issue before publishing again.",
      );
    }
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new ClientError(
        "invalid_response",
        "The server returned an unreadable response.",
        response.status,
      );
    }
    if (!response.ok) {
      const parsed = ErrorSchema.safeParse(data);
      throw new ClientError(
        parsed.success ? parsed.data.code : "request_failed",
        parsed.success
          ? parsed.data.message
          : "Request failed. Please try again.",
        response.status,
      );
    }
    const parsed = schema.safeParse(data);
    if (!parsed.success)
      throw new ClientError(
        "invalid_response",
        "The server response did not match the shared contract.",
      );
    return parsed.data;
  }
  return {
    issues: (signal?: AbortSignal) =>
      request("issues", IssuesResponseSchema, undefined, "GET", signal),
    issue: (id: string, signal?: AbortSignal) =>
      request(
        `issues/${z.uuid().parse(id)}`,
        IssueResponseSchema,
        undefined,
        "GET",
        signal,
      ),
    analyze: (body: z.input<typeof AnalyzeRequestSchema>) =>
      request(
        "analyze",
        AnalyzeResponseSchema,
        AnalyzeRequestSchema.parse(body),
      ),
    create: (body: z.input<typeof CreateIssueSchema>) =>
      request("issues", IssueResponseSchema, CreateIssueSchema.parse(body)),
    patch: (id: string, body: z.input<typeof PatchIssueSchema>) =>
      request(
        `issues/${z.uuid().parse(id)}`,
        IssueResponseSchema,
        PatchIssueSchema.parse(body),
        "PATCH",
      ),
    publish: (id: string) =>
      request(
        `issues/${z.uuid().parse(id)}/publish`,
        PublishResponseSchema,
        PublishRequestSchema.parse({ idempotencyKey: id, confirmed: true }),
      ),
    reconcile: (id: string) =>
      request(
        `issues/${z.uuid().parse(id)}/reconcile`,
        z.object({
          issue: IssueResponseSchema.shape.issue,
          remoteResult: z.enum(["existing", "unknown"]),
        }),
        ReconcileRequestSchema.parse({ confirmed: true }),
      ),
    repositories: (signal?: AbortSignal) =>
      request(
        "github/repositories",
        RepositoriesResponseSchema,
        undefined,
        "GET",
        signal,
      ),
    duplicates: (
      owner: string,
      repo: string,
      title: string,
      signal?: AbortSignal,
    ) =>
      request(
        `github/duplicates?${new URLSearchParams({ owner, repo, title })}`,
        DuplicatesResponseSchema,
        undefined,
        "GET",
        signal,
      ),
    startPairing: () =>
      request("pairing/start", PairingStartResponseSchema, {}),
    pollPairing: (
      body: z.input<typeof PairingStatusSchema>,
      signal?: AbortSignal,
    ) =>
      request(
        "pairing/status",
        PairingStatusResponseSchema,
        PairingStatusSchema.parse(body),
        "POST",
        signal,
      ),
    confirmPairing: (code: string) =>
      request(
        "pairing/confirm",
        z.object({ pairingId: z.uuid(), status: z.literal("approved") }),
        PairingConfirmSchema.parse({ code, confirmed: true }),
      ),
    revoke: (sessionId: string) =>
      request(
        "pairing/revoke",
        z.object({ revoked: z.literal(true) }),
        PairingRevokeSchema.parse({ sessionId }),
      ),
    account: () => request("account", AccountResponseSchema),
    disconnect: () =>
      request(
        "github/disconnect",
        DisconnectResponseSchema,
        DisconnectRequestSchema.parse({ confirmed: true }),
      ),
  };
}
export type Api = ReturnType<typeof createApi>;
export function messageOf(error: unknown) {
  if (error instanceof ClientError) return error.message;
  if (error instanceof z.ZodError)
    return error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
  return "Something went wrong. Your local work is preserved; try again.";
}
