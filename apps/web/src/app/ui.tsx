"use client";
import { useEffect, useState } from "react";
import type { Issue, IssueReport, Repository } from "@devflow/contracts";
async function api(path: string, body?: unknown, method?: string) {
  const r = await fetch(`/api/v1/${path}`, {
    method: method || (body ? "POST" : "GET"),
    headers: body ? { "Content-Type": "application/json" } : {},
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.message || "Request failed");
  return data;
}
export default function Dashboard() {
  const [message, setMessage] = useState(
    "Sign in to load your private dashboard.",
  );
  const [issues, setIssues] = useState<Issue[]>([]);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [repo, setRepo] = useState("");
  const [report, setReport] = useState("");
  const [capture, setCapture] = useState({
    pageTitle: "",
    url: "",
    selectedText: "",
    userNotes: "",
  });
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [capturedAt, setCapturedAt] = useState("");
  async function run(task: () => Promise<void>) {
    setBusy(true);
    try {
      await task();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }
  async function load() {
    setIssues((await api("issues")).issues);
    setMessage("Dashboard loaded.");
  }
  useEffect(() => {
    void api("issues")
      .then((d) => setIssues(d.issues))
      .catch(() => {});
  }, []);
  return (
    <main>
      <h1>DevFlow AI</h1>
      <p>
        Browser evidence → reviewed analysis → editable ProofPack → confirmed
        GitHub issue.
      </p>
      <p role="status">{message}</p>
      <section>
        <h2>Sign in</h2>
        <form action="/auth/login" method="post">
          <label>
            Email
            <input name="email" type="email" required />
          </label>
          <button>Send magic link</button>
        </form>
        <button disabled={busy} onClick={() => void run(load)}>
          Refresh dashboard
        </button>
      </section>
      <section>
        <h2>GitHub integration</h2>
        <a href="/api/github/install">Install GitHub App</a>
        <a href="/api/github/authorize">Authorize GitHub account</a>
        <button
          disabled={busy}
          onClick={() =>
            void run(async () =>
              setRepos((await api("github/repositories")).repositories),
            )
          }
        >
          Load authorized repositories
        </button>
        <label>
          Repository
          <select value={repo} onChange={(e) => setRepo(e.target.value)}>
            <option value="">Choose before publishing</option>
            {repos.map((r) => (
              <option key={r.fullName}>{r.fullName}</option>
            ))}
          </select>
        </label>
      </section>
      <section>
        <h2>Review capture</h2>
        <p>
          Remove passwords, keys, private account data and sensitive page text.
          Selected text will be sent to Gemini only with your consent.
        </p>
        {Object.entries(capture).map(([key, value]) => (
          <label key={key}>
            {key}
            <textarea
              value={value}
              onChange={(e) => {
                setCapture({ ...capture, [key]: e.target.value });
                setConsent(false);
                setReport("");
                setCapturedAt("");
              }}
            />
          </label>
        ))}
        <label>
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />{" "}
          I reviewed and redacted this capture and consent to server-side
          analysis.
        </label>
        <button
          disabled={busy || !consent}
          onClick={() =>
            void run(async () => {
              const timestamp = new Date().toISOString();
              const d = await api("analyze", {
                capture: {
                  ...capture,
                  capturedAt: timestamp,
                },
                consent: true,
              });
              setCapturedAt(timestamp);
              setReport(JSON.stringify(d.report, null, 2));
              setMessage(`Analysis mode: ${d.mode}. Review every field.`);
            })
          }
        >
          Analyze evidence
        </button>
        {report && (
          <>
            <label>
              Editable ProofPack (JSON)
              <textarea
                rows={24}
                value={report}
                onChange={(e) => setReport(e.target.value)}
              />
            </label>
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const [repoOwner, repoName] = repo.split("/");
                  await api("issues", {
                    report: JSON.parse(report) as IssueReport,
                    capture: {
                      ...capture,
                      capturedAt: capturedAt || new Date().toISOString(),
                    },
                    ...(repo ? { repoOwner, repoName } : {}),
                  });
                  await load();
                })
              }
            >
              Save draft
            </button>
          </>
        )}
      </section>
      <section>
        <h2>Persistent issues</h2>
        {issues.length === 0 && <p>No issues loaded.</p>}
        {issues.map((issue) => (
          <article key={issue.id}>
            <h3>{issue.report.title}</h3>
            <p>
              {issue.status} · {issue.repoOwner}/{issue.repoName}
            </p>
            <details>
              <summary>Review report and evidence</summary>
              <pre>{JSON.stringify(issue.report, null, 2)}</pre>
            </details>
            {["draft", "failed"].includes(issue.status) && (
              <>
                <button
                  disabled={busy}
                  onClick={() => {
                    setReport(JSON.stringify(issue.report, null, 2));
                    void run(async () => {
                      const edited = window.prompt(
                        "Edit report JSON",
                        JSON.stringify(issue.report),
                      );
                      if (edited) {
                        const [repoOwner, repoName] = repo.split("/");
                        await api(
                          `issues/${issue.id}`,
                          {
                            report: JSON.parse(edited),
                            ...(repo ? { repoOwner, repoName } : {}),
                          },
                          "PATCH",
                        );
                        await load();
                      }
                    });
                  }}
                >
                  Edit saved draft / set repository
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const d = await api(
                        `github/duplicates?${new URLSearchParams({ owner: issue.repoOwner || "", repo: issue.repoName || "", title: issue.report.title })}`,
                      );
                      setMessage(
                        `Duplicate candidates (heuristic): ${JSON.stringify(d.candidates)}`,
                      );
                    })
                  }
                >
                  Check duplicates
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      if (
                        !window.confirm(
                          "Create this reviewed issue in GitHub? This action is public to the selected repository.",
                        )
                      )
                        return;
                      const storageKey = `devflow:publish:${issue.id}`;
                      const key =
                        localStorage.getItem(storageKey) || crypto.randomUUID();
                      localStorage.setItem(storageKey, key);
                      const result = await api(`issues/${issue.id}/publish`, {
                        idempotencyKey: key,
                        confirmed: true,
                      });
                      await load();
                      setMessage(`Publish result: ${result.remoteResult}`);
                    })
                  }
                >
                  Confirm and publish
                </button>
              </>
            )}
            {["publish_unknown", "publishing"].includes(issue.status) && (
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const result = await api(`issues/${issue.id}/reconcile`, {
                      confirmed: true,
                    });
                    await load();
                    setMessage(`Reconciliation: ${result.remoteResult}`);
                  })
                }
              >
                Reconcile remote outcome
              </button>
            )}
            {issue.githubUrl && (
              <a href={issue.githubUrl} target="_blank" rel="noreferrer">
                Open GitHub issue
              </a>
            )}
          </article>
        ))}
      </section>
      <section>
        <h2>Extension pairing</h2>
        <p>Only approve a code shown by your own extension.</p>
        <label>
          Code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={8}
          />
        </label>
        <button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              if (
                !window.confirm(
                  "Approve this extension to analyze captures and manage drafts for one hour?",
                )
              )
                return;
              await api("pairing/confirm", { code, confirmed: true });
              setMessage("Extension pairing approved.");
            })
          }
        >
          Approve pairing
        </button>
        <label>
          Session ID to revoke
          <input
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
          />
        </label>
        <button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await api("pairing/revoke", { sessionId });
              setMessage("Session revoked.");
            })
          }
        >
          Revoke session
        </button>
      </section>
    </main>
  );
}
