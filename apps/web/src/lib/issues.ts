import "server-only";
import { IssueSchema, type Issue } from "@devflow/contracts";
import { ApiFault } from "./security";
import { admin, dbResult, type Actor } from "./supabase";
import {
  authorizeRepo,
  createRemote,
  GithubFault,
  reconcileRemote,
} from "./github";
export type IssueRow = {
  id: string;
  user_id: string;
  status: Issue["status"];
  report: Issue["report"];
  repo_owner: string | null;
  repo_name: string | null;
  github_issue_number: number | null;
  github_url: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
};
export function issueDTO(row: IssueRow): Issue {
  return IssueSchema.parse({
    id: row.id,
    status: row.status,
    report: row.report,
    ...(row.repo_owner ? { repoOwner: row.repo_owner } : {}),
    ...(row.repo_name ? { repoName: row.repo_name } : {}),
    ...(row.github_issue_number
      ? { githubIssueNumber: row.github_issue_number }
      : {}),
    ...(row.github_url ? { githubUrl: row.github_url } : {}),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  });
}
export async function getIssue(actor: Actor, id: string) {
  const { data, error } = await actor.db
    .from("issues")
    .select("*")
    .eq("user_id", actor.userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new ApiFault(503, "database_error", "Unable to read issue");
  if (!data) throw new ApiFault(404, "not_found", "Issue not found");
  return data as IssueRow;
}
export async function claim(userId: string, id: string, key: string) {
  const { data, error } = await admin().rpc("claim_publish", {
    p_user: userId,
    p_id: id,
    p_key: key,
  });
  if (error)
    throw new ApiFault(
      409,
      "publish_conflict",
      "Issue cannot be published with this idempotency key or state",
    );
  return data as { claimed: boolean; issue: IssueRow };
}
export async function finish(
  userId: string,
  id: string,
  key: string,
  status: Issue["status"],
  number?: number,
  url?: string,
  failure?: string,
) {
  return dbResult(
    await admin().rpc("finish_publish", {
      p_user: userId,
      p_id: id,
      p_key: key,
      p_status: status,
      p_number: number ?? null,
      p_url: url ?? null,
      p_failure: failure ?? null,
    }),
  ) as IssueRow;
}
export type PublisherDeps = {
  claim: typeof claim;
  finish: typeof finish;
  authorize: typeof authorizeRepo;
  create: typeof createRemote;
};
export async function publish(
  actor: Actor,
  id: string,
  key: string,
  deps: PublisherDeps = {
    claim,
    finish,
    authorize: authorizeRepo,
    create: createRemote,
  },
) {
  const result = await deps.claim(actor.userId, id, key);
  const row = result.issue;
  if (!result.claimed) {
    if (row.status === "published")
      return { issue: issueDTO(row), remoteResult: "existing" as const };
    if (row.status === "publish_unknown")
      return { issue: issueDTO(row), remoteResult: "unknown" as const };
    throw new ApiFault(
      409,
      "publish_in_progress",
      "Publication is already in progress",
    );
  }
  let remoteAttempted = false;
  try {
    const token = await deps.authorize(actor, row.repo_owner!, row.repo_name!);
    remoteAttempted = true;
    const remote = await deps.create(
      token,
      row.repo_owner!,
      row.repo_name!,
      row.report,
      key,
    );
    if (
      !Number.isInteger(remote.number) ||
      !/^https:\/\/github\.com\//.test(remote.html_url)
    )
      throw new GithubFault(502, true);
    const saved = await deps.finish(
      actor.userId,
      id,
      key,
      "published",
      remote.number,
      remote.html_url,
    );
    return { issue: issueDTO(saved), remoteResult: "created" as const };
  } catch (error) {
    const unknown =
      remoteAttempted && (!(error instanceof GithubFault) || error.uncertain);
    const status = unknown ? "publish_unknown" : "failed";
    const saved = await deps.finish(
      actor.userId,
      id,
      key,
      status,
      undefined,
      undefined,
      unknown
        ? "Remote outcome uncertain; reconciliation required"
        : "GitHub authorization or request failed",
    );
    return {
      issue: issueDTO(saved),
      remoteResult: unknown ? ("unknown" as const) : ("failed" as const),
    };
  }
}
export async function reconcile(actor: Actor, id: string) {
  let row = await getIssue(actor, id);
  if (row.status === "publishing" && row.idempotency_key)
    row = (await claim(actor.userId, id, row.idempotency_key)).issue;
  if (row.status === "published")
    return { issue: issueDTO(row), remoteResult: "existing" };
  if (row.status !== "publish_unknown" || !row.idempotency_key)
    throw new ApiFault(
      409,
      "not_unknown",
      "Issue does not need reconciliation",
    );
  const token = await authorizeRepo(actor, row.repo_owner!, row.repo_name!);
  const remote = await reconcileRemote(
    token,
    row.repo_owner!,
    row.repo_name!,
    row.idempotency_key,
  );
  if (!remote) return { issue: issueDTO(row), remoteResult: "unknown" };
  row = await finish(
    actor.userId,
    id,
    row.idempotency_key,
    "published",
    remote.number,
    remote.html_url,
  );
  return { issue: issueDTO(row), remoteResult: "existing" };
}
