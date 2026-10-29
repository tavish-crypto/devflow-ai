import "server-only";
import { createAppAuth } from "@octokit/auth-app";
import type { IssueReport, Repository } from "@devflow/contracts";
import { ApiFault, decrypt, required } from "./security";
import { admin, type Actor } from "./supabase";
export class GithubFault extends ApiFault {
  constructor(
    status: number,
    public uncertain = false,
  ) {
    super(
      status === 429 ? 429 : 502,
      status === 429 ? "github_rate_limit" : "github_error",
      "GitHub request failed",
    );
  }
}
export async function gh(
  path: string,
  token: string,
  options: RequestInit = {},
  api = true,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(
      `${api ? "https://api.github.com" : "https://github.com"}${path}`,
      {
        ...options,
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
        signal: AbortSignal.timeout(10000),
        redirect: "error",
      },
    );
  } catch {
    throw new GithubFault(502, options.method === "POST");
  }
  if (!response.ok) {
    const limited =
      response.status === 429 ||
      (response.status === 403 &&
        response.headers.get("x-ratelimit-remaining") === "0");
    throw new GithubFault(
      limited ? 429 : response.status,
      response.status >= 500 && options.method === "POST",
    );
  }
  try {
    return await response.json();
  } catch {
    throw new GithubFault(502, options.method === "POST");
  }
}
type RepoPage = {
  repositories: {
    owner: { login: string };
    name: string;
    full_name: string;
    private: boolean;
  }[];
};
export async function connection(actor: Actor) {
  const { data, error } = await admin()
    .from("github_connections")
    .select("*")
    .eq("user_id", actor.userId)
    .maybeSingle();
  if (error || !data)
    throw new ApiFault(
      409,
      "github_not_connected",
      "Connect a GitHub App installation first",
    );
  return data;
}
export async function repositories(actor: Actor): Promise<Repository[]> {
  const c = await connection(actor);
  const token = decrypt(c.encrypted_user_token);
  const repos: Repository[] = [];
  for (let page = 1; page <= 20; page++) {
    const result = (await gh(
      `/user/installations/${c.installation_id}/repositories?per_page=100&page=${page}`,
      token,
    )) as RepoPage;
    repos.push(
      ...result.repositories.map((r) => ({
        owner: r.owner.login,
        name: r.name,
        fullName: r.full_name,
        private: r.private,
      })),
    );
    if (result.repositories.length < 100) return repos;
  }
  throw new ApiFault(
    422,
    "too_many_repositories",
    "Narrow the GitHub App installation repository selection",
  );
}
export async function authorizeRepo(actor: Actor, owner: string, name: string) {
  if (
    !(await repositories(actor)).some(
      (r) => r.fullName.toLowerCase() === `${owner}/${name}`.toLowerCase(),
    )
  )
    throw new ApiFault(
      403,
      "repository_denied",
      "Repository is not authorized",
    );
  const c = await connection(actor);
  const auth = createAppAuth({
    appId: required("GITHUB_APP_ID"),
    privateKey: Buffer.from(
      required("GITHUB_PRIVATE_KEY_BASE64"),
      "base64",
    ).toString("utf8"),
    clientId: required("GITHUB_CLIENT_ID"),
    clientSecret: required("GITHUB_CLIENT_SECRET"),
  });
  const result = await auth({
    type: "installation",
    installationId: Number(c.installation_id),
    repositoryNames: [name],
    permissions: { issues: "write", metadata: "read" },
  });
  return result.token;
}
export function heuristic(title: string, query: string) {
  const words = (s: string) =>
    new Set(s.toLowerCase().match(/[a-z0-9]+/g) || []);
  const a = words(title),
    b = words(query);
  return b.size
    ? [...b].filter((w) => a.has(w)).length / new Set([...a, ...b]).size
    : 0;
}
export async function duplicates(
  token: string,
  owner: string,
  repo: string,
  title: string,
) {
  const query = encodeURIComponent(
    `repo:${owner}/${repo} is:issue ${title.slice(0, 200)}`,
  );
  const result = (await gh(`/search/issues?q=${query}&per_page=20`, token)) as {
    items: { number: number; title: string; html_url: string; state: string }[];
  };
  return result.items
    .map((i) => ({
      number: i.number,
      title: i.title,
      url: i.html_url,
      state: i.state,
      score: heuristic(i.title, title),
    }))
    .sort((a, b) => b.score - a.score);
}
const escape = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/@/g, "&#64;");
export function issueBody(report: IssueReport, marker: string) {
  const sections = [
    ["Summary", report.summary],
    ["Actual behavior", report.actualBehavior],
    ["Expected behavior", report.expectedBehavior],
    ["Reproduction steps", report.reproductionSteps.join("\n")],
    ["Possible cause (unverified)", report.possibleCause],
    ["Suggested fix (unverified)", report.suggestedFix],
    ["Missing information", report.missingInformation.join("\n")],
    [
      "Evidence",
      report.evidence.map((e) => `[${e.source}] ${e.content}`).join("\n"),
    ],
  ];
  return (
    sections
      .map(([title, value]) => `## ${title}\n${escape(value || "Unknown")}`)
      .join("\n\n") + `\n\n<!-- devflow:${marker} -->`
  );
}
export type RemoteIssue = { number: number; html_url: string };
export async function createRemote(
  token: string,
  owner: string,
  repo: string,
  report: IssueReport,
  key: string,
) {
  return (await gh(`/repos/${owner}/${repo}/issues`, token, {
    method: "POST",
    body: JSON.stringify({ title: report.title, body: issueBody(report, key) }),
    headers: { "Content-Type": "application/json" },
  })) as RemoteIssue;
}
export async function reconcileRemote(
  token: string,
  owner: string,
  repo: string,
  key: string,
) {
  for (let page = 1; page <= 20; page++) {
    const issues = (await gh(
      `/repos/${owner}/${repo}/issues?state=all&sort=created&direction=desc&per_page=100&page=${page}`,
      token,
    )) as (RemoteIssue & { body: string | null; pull_request?: unknown })[];
    const found = issues.find(
      (i) => !i.pull_request && i.body?.includes(`<!-- devflow:${key} -->`),
    );
    if (found) return found;
    if (issues.length < 100) return null;
  }
  return null;
}
