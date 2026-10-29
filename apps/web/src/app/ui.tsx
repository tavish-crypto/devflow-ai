"use client";
import { useEffect, useMemo, useState } from "react";
import type { Issue, Repository } from "@devflow/contracts";
import { createApi, messageOf } from "@devflow/product/api";
import {
  Badge,
  Button,
  Busy,
  Notice,
  IssueList,
  Transition,
  FileText,
  Github,
  Clock3,
  CheckCircle2,
  Plus,
  ArrowUpRight,
  Search,
  Fingerprint,
} from "@devflow/product";
const api = createApi();
export function filterIssues(
  issues: Issue[],
  search: string,
  status: string,
  priority: string,
  repo: string,
) {
  return issues.filter(
    (i) =>
      (!search ||
        `${i.report.title} ${i.report.summary}`
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (!status || i.status === status) &&
      (!priority || i.report.priority === priority) &&
      (!repo || `${i.repoOwner}/${i.repoName}` === repo),
  );
}
export default function Dashboard({
  view = "overview",
}: {
  view?: "overview" | "issues";
}) {
  const [issues, setIssues] = useState<Issue[]>([]),
    [repos, setRepos] = useState<Repository[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [repoError, setRepoError] = useState(""),
    [reload, setReload] = useState(0);
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [priority, setPriority] = useState(""),
    [repo, setRepo] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api
      .issues(controller.signal)
      .then((d) => setIssues(d.issues))
      .catch((e) => {
        if (!controller.signal.aborted) setError(messageOf(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    api
      .repositories(controller.signal)
      .then((d) => {
        setRepos(d.repositories);
        setRepoError("");
      })
      .catch((e) => {
        if (!controller.signal.aborted) setRepoError(messageOf(e));
      });
    return () => controller.abort();
  }, [reload]);
  const filtered = useMemo(
    () => filterIssues(issues, search, status, priority, repo),
    [issues, search, status, priority, repo],
  );
  const repoNames = [
    ...new Set(
      issues
        .filter((i) => i.repoOwner)
        .map((i) => `${i.repoOwner}/${i.repoName}`),
    ),
  ];
  if (loading) return <Busy />;
  return (
    <Transition>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR DEVELOPER COMMAND CENTER</span>
          <h1 className="mt-2">
            {view === "overview"
              ? "A little context. A lot of clarity."
              : "Every issue. All the evidence."}
          </h1>
          <p>
            {view === "overview"
              ? "Your reports, from first capture to published issue."
              : "Find, refine, and follow your ProofPacks."}
          </p>
        </div>
        <Button asChild>
          <a href="/dashboard/new">
            <Plus size={15} />
            Capture issue
          </a>
        </Button>
      </div>
      {error ? (
        <div className="stack">
          <Notice tone="error">{error}</Notice>
          <Button variant="secondary" onClick={() => setReload(reload + 1)}>
            Reload workspace
          </Button>
        </div>
      ) : (
        <>
          {view === "overview" && (
            <div className="kpis">
              {[
                [
                  "Reports in workspace",
                  issues.length,
                  "Latest 100 saved reports",
                  FileText,
                ],
                [
                  "Published to GitHub",
                  issues.filter((i) => i.status === "published").length,
                  "Verified publication links",
                  CheckCircle2,
                ],
                [
                  "Drafts in progress",
                  issues.filter((i) => i.status === "draft").length,
                  "Ready when you are",
                  Clock3,
                ],
              ].map(([label, count, note, Icon]) => {
                const I = Icon as typeof FileText;
                return (
                  <div className="kpi" key={String(label)}>
                    <div className="kpi-head">
                      {String(label)}
                      <I size={17} />
                    </div>
                    <strong>{String(count)}</strong>
                    <small>{String(note)}</small>
                  </div>
                );
              })}
            </div>
          )}
          <div className={view === "overview" ? "overview-grid" : ""}>
            <section className="panel">
              <div className="panel-header">
                <div>
                  <h3>
                    {view === "overview" ? "Recent reports" : "Issue explorer"}
                  </h3>
                  <p>
                    {view === "overview"
                      ? "Pick up where you left off."
                      : "Private to your account · newest first"}
                  </p>
                </div>
                {view === "overview" ? (
                  <a className="muted text-sm" href="/dashboard/issues">
                    View all <ArrowUpRight size={13} />
                  </a>
                ) : (
                  <Badge>{issues.length} reports</Badge>
                )}
              </div>
              {view === "issues" && (
                <>
                  <div className="filters">
                    <div className="search-wrap">
                      <Search size={14} />
                      <input
                        aria-label="Search issues"
                        placeholder="Search title or summary…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <select
                      aria-label="Filter status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      <option value="">All statuses</option>
                      {[
                        "draft",
                        "published",
                        "failed",
                        "publishing",
                        "publish_unknown",
                      ].map((s) => (
                        <option key={s} value={s}>
                          {s.replaceAll("_", " ")}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Filter priority"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                    >
                      <option value="">All priorities</option>
                      {["low", "medium", "high"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                    <select
                      aria-label="Filter repository"
                      value={repo}
                      onChange={(e) => setRepo(e.target.value)}
                    >
                      <option value="">All repositories</option>
                      {repoNames.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="result-note">
                    Showing {filtered.length} of {issues.length} loaded reports.
                    The API returns the latest 100.
                  </div>
                </>
              )}
              <IssueList
                issues={view === "overview" ? issues.slice(0, 6) : filtered}
                href={(i) => `/dashboard/issues/${i.id}`}
                emptyAction={
                  <Button asChild variant="secondary">
                    <a href="/dashboard/new">
                      <Plus size={14} />
                      Create a report
                    </a>
                  </Button>
                }
              />
            </section>
            {view === "overview" && (
              <div className="stack">
                <section className="panel">
                  <div className="panel-header">
                    <h3>
                      <Github size={16} /> Repositories
                    </h3>
                    <Badge tone={repoError ? "amber" : "mint"}>
                      {repoError
                        ? "Action needed"
                        : `${repos.length} authorized`}
                    </Badge>
                  </div>
                  {repoError ? (
                    <div className="panel-body">
                      <p className="muted text-sm">{repoError}</p>
                      <a
                        href="/dashboard/integrations"
                        className="inline-link text-sm"
                      >
                        Manage GitHub connection <ArrowUpRight size={12} />
                      </a>
                    </div>
                  ) : (
                    <>
                      <div className="panel-body">
                        <p className="muted text-sm">
                          {repos.length
                            ? repos
                                .slice(0, 3)
                                .map((r) => r.fullName)
                                .join(" · ")
                            : "No repositories authorized yet."}
                        </p>
                      </div>
                      <a
                        href="/dashboard/integrations"
                        className="repo-card inline-link text-sm"
                      >
                        Manage repositories <ArrowUpRight size={12} />
                      </a>
                    </>
                  )}
                </section>
                <section className="panel">
                  <div className="panel-header">
                    <h3>
                      <Fingerprint size={16} /> Your path to proof
                    </h3>
                  </div>
                  {[
                    [
                      "01",
                      "Capture with intention",
                      "Select only what’s relevant.",
                    ],
                    [
                      "02",
                      "Review every claim",
                      "Separate evidence from suggestions.",
                    ],
                    [
                      "03",
                      "Publish with confidence",
                      "Check duplicates. Give approval.",
                    ],
                  ].map(([n, title, text]) => (
                    <div key={n} className="workflow-step">
                      <span>{n}</span>
                      <div>
                        <strong>{title}</strong>
                        <p>{text}</p>
                      </div>
                    </div>
                  ))}
                </section>
              </div>
            )}
          </div>
        </>
      )}
      <p className="footer-hint">
        <Fingerprint size={13} /> Your evidence stays yours. You decide what
        gets published.
      </p>
    </Transition>
  );
}
