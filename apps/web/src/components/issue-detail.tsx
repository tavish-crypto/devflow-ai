"use client";
import { useEffect, useRef, useState } from "react";
import {
  IssueReportSchema,
  type Issue,
  type IssueReport,
  type Repository,
} from "@devflow/contracts";
import {
  Badge,
  Button,
  Busy,
  Confirm,
  Duplicates,
  Field,
  Notice,
  ProofEditor,
  Saved,
  Status,
  Transition,
  ChevronLeft,
  Github,
  Copy,
  CheckCircle2,
  safeExternal,
} from "@devflow/product";
import { createApi, messageOf } from "@devflow/product/api";
import { useIdentity } from "./workspace";
const api = createApi();
type Candidate = {
  number: number;
  title: string;
  url: string;
  state: string;
  score: number;
};
export default function IssueDetail({ id }: { id: string }) {
  const { id: userId } = useIdentity(),
    key = `devflow:issue:${userId}:${id}`;
  const [issue, setIssue] = useState<Issue | null>(null),
    [report, setReport] = useState<IssueReport | null>(null),
    [repos, setRepos] = useState<Repository[]>([]),
    [repo, setRepo] = useState("");
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [repoError, setRepoError] = useState(""),
    [message, setMessage] = useState(""),
    [confirm, setConfirm] = useState(false),
    [checked, setChecked] = useState(false),
    [distinct, setDistinct] = useState(false),
    [candidates, setCandidates] = useState<Candidate[]>([]),
    [reload, setReload] = useState(0),
    [uncertain, setUncertain] = useState(false);
  const lock = useRef(false);
  const editable = issue?.status === "draft" || issue?.status === "failed";
  const dirty =
    !!issue &&
    (JSON.stringify(report) !== JSON.stringify(issue.report) ||
      repo !== (issue.repoOwner ? `${issue.repoOwner}/${issue.repoName}` : ""));
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    api
      .issue(id, c.signal)
      .then((d) => {
        setIssue(d.issue);
        setReport(d.issue.report);
        setRepo(
          d.issue.repoOwner ? `${d.issue.repoOwner}/${d.issue.repoName}` : "",
        );
        setUncertain(false);
        setChecked(false);
        setDistinct(false);
        setError("");
        if (["draft", "failed"].includes(d.issue.status))
          try {
            const raw = localStorage.getItem(key);
            if (raw) {
              const local = JSON.parse(raw);
              if (local.updatedAt === d.issue.updatedAt) {
                const r = IssueReportSchema.safeParse(local.report);
                if (r.success) {
                  setReport(r.data);
                  setRepo(local.repo);
                  setMessage(
                    "Recovered your unsaved changes from this device.",
                  );
                }
              }
            }
          } catch {
            /* Invalid recovery is ignored. */
          }
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(messageOf(e));
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    api
      .repositories(c.signal)
      .then((d) => setRepos(d.repositories))
      .catch((e) => {
        if (!c.signal.aborted) setRepoError(messageOf(e));
      });
    return () => c.abort();
  }, [id, key, reload]);
  useEffect(() => {
    if (!issue || !report || !editable) return;
    try {
      if (dirty)
        localStorage.setItem(
          key,
          JSON.stringify({ updatedAt: issue.updatedAt, report, repo }),
        );
      else localStorage.removeItem(key);
    } catch {
      setError(
        "Device recovery storage is unavailable. Save your changes before leaving.",
      );
    }
  }, [issue, report, repo, editable, dirty, key]);
  useEffect(() => {
    if (!dirty) return;
    const guard = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  async function run(task: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await task();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function changed(next: IssueReport) {
    setReport(next);
    setChecked(false);
    setDistinct(false);
  }
  async function save() {
    if (!report) return;
    await run(async () => {
      const [repoOwner, repoName] = repo.split("/");
      const d = await api.patch(id, {
        report,
        ...(repoOwner && repoName ? { repoOwner, repoName } : {}),
      });
      setIssue(d.issue);
      setReport(d.issue.report);
      setMessage("Draft saved to your workspace.");
      localStorage.removeItem(key);
    });
  }
  async function radar() {
    if (!issue?.repoOwner) return;
    await run(async () => {
      const d = await api.duplicates(
        issue.repoOwner!,
        issue.repoName!,
        issue.report.title,
      );
      setCandidates(d.candidates);
      setChecked(true);
      setDistinct(false);
    });
  }
  async function publish() {
    setConfirm(false);
    await run(async () => {
      try {
        const d = await api.publish(id);
        setIssue(d.issue);
        setReport(d.issue.report);
        setMessage(
          d.remoteResult === "created" || d.remoteResult === "existing"
            ? "Published. Your evidence now has a home on GitHub."
            : d.remoteResult === "unknown"
              ? "The remote outcome is uncertain. Reconcile before taking any further action."
              : "GitHub declined publication. Your report is saved; check integration permissions before retrying.",
        );
      } catch (e) {
        setUncertain(true);
        throw e;
      }
    });
  }
  async function reconcile() {
    await run(async () => {
      const d = await api.reconcile(id);
      setIssue(d.issue);
      setReport(d.issue.report);
      setMessage(
        d.remoteResult === "existing"
          ? "Found and linked your GitHub issue."
          : "No matching marker was found. Inspect GitHub manually; do not retry publication.",
      );
    });
  }
  if (loading) return <Busy label="Opening your ProofPack…" />;
  if (!issue || !report)
    return (
      <div className="stack">
        <Notice tone="error">{error || "Issue not found."}</Notice>
        <Button onClick={() => setReload(reload + 1)}>Reload issue</Button>
        <a href="/dashboard/issues">Back to issues</a>
      </div>
    );
  return (
    <Transition>
      <a href="/dashboard/issues" className="back-link">
        <ChevronLeft size={14} />
        All issues
      </a>
      <div className="page-heading">
        <div>
          <div className="actions mb-3">
            <Status status={issue.status} />
            <span className="issue-id">DF-{id.slice(0, 8)}</span>
          </div>
          <h1>{issue.report.title}</h1>
          <p>One report. A traceable path from evidence to action.</p>
        </div>
        <Saved dirty={dirty} />
      </div>
      <div className="stack">
        {error && <Notice tone="error">{error}</Notice>}
        {message && (
          <Notice tone={issue.status === "published" ? "success" : "info"}>
            {message}
          </Notice>
        )}
        {uncertain && (
          <Notice tone="error">
            The request may have reached GitHub. Reload the server state before
            continuing. Never submit a new report to retry this publication.
            <Button variant="secondary" onClick={() => setReload(reload + 1)}>
              Reload server state
            </Button>
          </Notice>
        )}
        <div className="editor-grid">
          <section className="panel">
            <div className="panel-body">
              <ProofEditor
                report={report}
                onChange={changed}
                disabled={!editable || busy}
              />
              {editable && (
                <div className="actions mt-6">
                  <Button disabled={busy || !dirty} onClick={save}>
                    {busy ? "Saving…" : "Save draft"}
                  </Button>
                  <Saved dirty={dirty} />
                </div>
              )}
            </div>
          </section>
          <aside className="sticky-review stack">
            <section className="review-card stack">
              <h3>
                <Github size={18} /> Publication
              </h3>
              <div className="metadata">
                <div>
                  <span>Created</span>
                  <span>{new Date(issue.createdAt).toLocaleString()}</span>
                </div>
                <div>
                  <span>Last saved</span>
                  <span>{new Date(issue.updatedAt).toLocaleString()}</span>
                </div>
              </div>
              {issue.githubUrl ? (
                <>
                  <Badge tone="mint">
                    <CheckCircle2 size={12} /> GitHub issue #
                    {issue.githubIssueNumber}
                  </Badge>
                  <Button asChild>
                    <a
                      href={safeExternal(issue.githubUrl)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open on GitHub
                    </a>
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      navigator.clipboard
                        .writeText(issue.githubUrl!)
                        .then(() => setMessage("Issue URL copied."))
                        .catch(() =>
                          setError(
                            "Clipboard unavailable. Copy the GitHub link manually.",
                          ),
                        );
                    }}
                  >
                    <Copy size={14} />
                    Copy issue URL
                  </Button>
                </>
              ) : editable ? (
                <>
                  <Field label="Repository">
                    <select
                      value={repo}
                      disabled={busy}
                      onChange={(e) => {
                        setRepo(e.target.value);
                        setChecked(false);
                        setDistinct(false);
                      }}
                    >
                      <option value="" disabled>
                        Choose repository
                      </option>
                      {repos.map((r) => (
                        <option key={r.fullName} value={r.fullName}>
                          {r.fullName}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {repoError && (
                    <Notice>
                      {repoError}{" "}
                      <a className="inline-link" href="/dashboard/integrations">
                        Manage connection
                      </a>
                    </Notice>
                  )}
                  <p className="muted text-sm">
                    Save your report and repository before checking for
                    duplicates.
                  </p>
                  <Button
                    variant="secondary"
                    disabled={busy || dirty || !issue.repoOwner || uncertain}
                    onClick={radar}
                  >
                    {busy ? "Working…" : "Check possible duplicates"}
                  </Button>
                  {checked && (
                    <>
                      <Duplicates candidates={candidates} />
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={distinct}
                          onChange={(e) => setDistinct(e.target.checked)}
                        />
                        I reviewed the results and this report is distinct.
                      </label>
                    </>
                  )}
                  <Button
                    disabled={
                      busy ||
                      dirty ||
                      !checked ||
                      !distinct ||
                      uncertain ||
                      !issue.repoOwner
                    }
                    onClick={() => setConfirm(true)}
                  >
                    Review &amp; publish
                  </Button>
                  <p className="muted text-sm">
                    Publishing creates a real issue visible to everyone with
                    repository access.
                  </p>
                </>
              ) : (
                <>
                  <Notice>
                    Publication is{" "}
                    {issue.status === "publishing"
                      ? "in progress. Wait at least 30 seconds before checking a potentially interrupted request."
                      : "uncertain. Check GitHub for the existing issue before any further action."}
                  </Notice>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={reconcile}
                  >
                    Reconcile with GitHub
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setReload(reload + 1)}
                  >
                    Refresh status
                  </Button>
                </>
              )}
            </section>
          </aside>
        </div>
      </div>
      <Confirm
        open={confirm}
        onOpenChange={setConfirm}
        title="Create this GitHub issue?"
        onConfirm={publish}
        busy={busy}
        label="Publish to GitHub"
      >
        You are publishing “{issue.report.title}” to{" "}
        <strong>
          {issue.repoOwner}/{issue.repoName}
        </strong>
        . The report includes the evidence shown here. Review sensitive material
        before proceeding.
      </Confirm>
    </Transition>
  );
}
