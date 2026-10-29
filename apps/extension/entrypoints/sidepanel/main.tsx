import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { browser } from "wxt/browser";
import { z } from "zod";
import {
  CaptureInputSchema,
  IssueReportSchema,
  PairingStartResponseSchema,
  PairingStatusResponseSchema,
  type CaptureInput,
  type Issue,
  type IssueReport,
} from "@devflow/contracts";
import { createApi, ClientError, messageOf } from "@devflow/product/api";
import {
  Badge,
  Brand,
  Button,
  Busy,
  CapturePreview,
  Confirm,
  IssueList,
  Notice,
  ProofEditor,
  Transition,
  MousePointer2,
  Github,
  Settings,
  Clock3,
  ShieldCheck,
  ChevronLeft,
  ArrowUpRight,
  Copy,
  safeExternal,
} from "@devflow/product";
import "./style.css";
import {
  LocalDraftsSchema,
  preserveDraft,
  type LocalDraft,
} from "../../src/workspace";
const origin = __DEVFLOW_ORIGIN__;
type Session = Extract<
  z.infer<typeof PairingStatusResponseSchema>,
  { status: "approved" }
>;
type Pairing = z.infer<typeof PairingStartResponseSchema>;
const emptyCapture = (): CaptureInput => ({
  pageTitle: "",
  url: "",
  selectedText: "",
  userNotes: "",
  capturedAt: new Date().toISOString(),
});
export function Panel() {
  const [session, setSession] = useState<Session | null>(null),
    [pairing, setPairing] = useState<Pairing | null>(null),
    [view, setView] = useState("home"),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [capture, setCapture] = useState<CaptureInput>(emptyCapture),
    [report, setReport] = useState<IssueReport | null>(null),
    [issue, setIssue] = useState<Issue | null>(null),
    [consent, setConsent] = useState(false),
    [issues, setIssues] = useState<Issue[]>([]),
    [mode, setMode] = useState(""),
    [disconnect, setDisconnect] = useState(false);
  const lock = useRef(false),
    restore = useRef(true),
    lastPoll = useRef(0);
  const [localDrafts, setLocalDrafts] = useState<LocalDraft[]>([]);
  const latest = useRef({ capture, report, issue, mode });
  latest.current = { capture, report, issue, mode };
  async function remember() {
    const stored = await browser.storage.local.get("localDrafts");
    const parsed = LocalDraftsSchema.safeParse(stored.localDrafts);
    const next = preserveDraft(
      parsed.success ? parsed.data : [],
      latest.current,
    );
    await browser.storage.local.set({ localDrafts: next });
    setLocalDrafts(next);
  }
  const api = createApi(origin, session?.token);
  async function acceptCapture(event: {
    capture?: CaptureInput;
    error?: string;
  }) {
    setConsent(false);
    setError(event.error ?? "");
    if (event.capture) {
      try {
        await remember();
      } catch {
        setError("The previous draft could not be archived on this device.");
        return;
      }
      setCapture(event.capture);
      setReport(null);
      setIssue(null);
      setView("capture");
    } else if (event.error) setView("home");
  }
  useEffect(() => {
    let active = true;
    Promise.all([
      browser.storage.session.get(["session", "pairing"]),
      browser.storage.local.get(["workspace", "captureEvent", "localDrafts"]),
    ])
      .then(([secure, local]) => {
        if (!active) return;
        const s = PairingStatusResponseSchema.safeParse(secure.session);
        if (
          s.success &&
          s.data.status === "approved" &&
          Date.parse(s.data.expiresAt) > Date.now()
        )
          setSession(s.data);
        const p = PairingStartResponseSchema.safeParse(secure.pairing);
        if (p.success && Date.parse(p.data.expiresAt) > Date.now())
          setPairing(p.data);
        const workspace = local.workspace as
          | {
              capture?: unknown;
              report?: unknown;
              issue?: Issue;
              mode?: string;
              captureEventAt?: number;
            }
          | undefined;
        const c = CaptureInputSchema.safeParse(workspace?.capture);
        if (c.success) setCapture(c.data);
        const r = IssueReportSchema.safeParse(workspace?.report);
        if (r.success) {
          setReport(r.data);
          setView("editor");
        }
        if (workspace?.issue) setIssue(workspace.issue);
        if (workspace?.mode) setMode(workspace.mode);
        const saved = LocalDraftsSchema.safeParse(local.localDrafts);
        if (saved.success) setLocalDrafts(saved.data);
        if (c.success)
          latest.current = {
            capture: c.data,
            report: r.success ? r.data : null,
            issue: workspace?.issue ?? null,
            mode: workspace?.mode ?? "",
          };
        const event = local.captureEvent as
          { capture?: CaptureInput; error?: string; at: number } | undefined;
        if (event && event.at > (workspace?.captureEventAt ?? 0))
          void acceptCapture(event);
        restore.current = false;
        setReady(true);
      })
      .catch(() => {
        if (active) {
          restore.current = false;
          setReady(true);
          setError("Browser storage is unavailable. Reopen the side panel.");
        }
      });
    const listener: Parameters<
      typeof browser.storage.onChanged.addListener
    >[0] = (changes, area) => {
      if (area === "local" && changes.captureEvent?.newValue)
        void acceptCapture(
          changes.captureEvent.newValue as {
            capture?: CaptureInput;
            error?: string;
          },
        );
    };
    browser.storage.onChanged.addListener(listener);
    return () => {
      active = false;
      browser.storage.onChanged.removeListener(listener);
    };
  }, []);
  useEffect(() => {
    if (restore.current || !ready) return;
    void browser.storage.local
      .get("captureEvent")
      .then((data) =>
        browser.storage.local.set({
          workspace: {
            capture,
            report,
            issue,
            mode,
            captureEventAt:
              (data.captureEvent as { at?: number } | undefined)?.at ?? 0,
          },
        }),
      )
      .catch(() =>
        setError(
          "Draft recovery could not be saved. Keep the panel open and save to your account.",
        ),
      );
  }, [capture, report, issue, mode, ready]);
  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(
      () => {
        setSession(null);
        void browser.storage.session.remove("session");
        setError(
          "Your extension session expired. Pair again to continue; local work is preserved.",
        );
      },
      Math.max(0, Date.parse(session.expiresAt) - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [session]);
  async function run(task: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (e) {
      if (e instanceof ClientError && e.status === 401) {
        setSession(null);
        await browser.storage.session.remove("session");
      }
      setError(messageOf(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function startPairing() {
    await run(async () => {
      const result = await createApi(origin).startPairing();
      await browser.storage.session.set({ pairing: result });
      setPairing(result);
    });
  }
  async function poll() {
    if (!pairing) return;
    if (Date.now() - lastPoll.current < 3000) {
      setNotice("Please wait three seconds before checking again.");
      return;
    }
    lastPoll.current = Date.now();
    await run(async () => {
      if (Date.parse(pairing.expiresAt) <= Date.now()) {
        setPairing(null);
        await browser.storage.session.remove("pairing");
        throw new ClientError(
          "pairing_expired",
          "This code has expired. Start a new connection.",
        );
      }
      const result = await createApi(origin).pollPairing({
        pairingId: pairing.pairingId,
        pollingSecret: pairing.pollingSecret,
      });
      if (result.status === "pending") {
        setNotice(
          "Waiting for approval. Enter the code in your dashboard, then check again.",
        );
        return;
      }
      await browser.storage.session.set({ session: result });
      await browser.storage.session.remove("pairing");
      setSession(result);
      setPairing(null);
      setNotice("Extension paired. Your local draft is ready.");
    });
  }
  async function recapture() {
    await run(async () => {
      const result = await browser.runtime.sendMessage({
        type: "capture-active",
      });
      if (result?.error) setError(result.error);
    });
  }
  async function analyze() {
    await run(async () => {
      const result = await api.analyze({ capture, consent: consent as true });
      setReport(result.report);
      setIssue(null);
      setMode(result.mode);
      setView("editor");
    });
  }
  async function save() {
    if (!report) return;
    await run(async () => {
      const result = issue
        ? await api.patch(issue.id, { report })
        : await api.create({ capture, report });
      setIssue(result.issue);
      setReport(result.issue.report);
      setNotice(
        "Draft saved. Continue in the dashboard to choose a repository, check duplicates, and approve publication.",
      );
    });
  }
  async function history() {
    setView("history");
    await run(async () => {
      setIssues((await api.issues()).issues);
    });
  }
  function open(path: string) {
    void browser.tabs.create({ url: `${origin}${path}` });
  }
  const dirty =
    !issue || JSON.stringify(report) !== JSON.stringify(issue.report);
  if (!ready) return <Busy label="Opening DevFlow…" />;
  return (
    <div className="extension">
      <header className="extension-header">
        <Brand />
        <Badge tone={session ? "mint" : "amber"}>
          {session ? "Connected" : "Pair to connect"}
        </Badge>
      </header>
      <nav className="extension-tabs" aria-label="Extension navigation">
        <Button
          variant="ghost"
          className={view === "home" ? "active" : ""}
          onClick={() => setView("home")}
        >
          <MousePointer2 size={14} />
          Capture
        </Button>
        <Button
          variant="ghost"
          className={view === "history" ? "active" : ""}
          disabled={!session || busy}
          onClick={history}
        >
          <Clock3 size={14} />
          History
        </Button>
        <Button
          variant="ghost"
          className={view === "settings" ? "active" : ""}
          onClick={() => setView("settings")}
        >
          <Settings size={14} />
          Settings
        </Button>
      </nav>
      <main className="extension-body">
        <Transition>
          <div className="stack">
            {error && <Notice tone="error">{error}</Notice>}
            {notice && <Notice tone="success">{notice}</Notice>}
            {!session ? (
              <>
                <span className="eyebrow">YOUR BROWSER-TO-ISSUE WORKSPACE</span>
                <h1>A useful report starts with what you saw.</h1>
                <p className="muted">
                  Select an error and click DevFlow’s toolbar icon. Review your
                  evidence, let Gemini draft, and keep the final say.
                </p>
                <Notice>
                  <ShieldCheck size={14} /> Capture is always user-triggered.
                  Your selection stays on this device until you approve
                  analysis.
                </Notice>
                {pairing ? (
                  <>
                    <div className="pair-code mono">{pairing.code}</div>
                    <p className="pair-details">
                      Code expires at{" "}
                      {new Date(pairing.expiresAt).toLocaleTimeString()}. Open
                      the dashboard, sign in, and approve this code.
                    </p>
                    <Button onClick={() => open("/connect-extension")}>
                      Open pairing approval <ArrowUpRight size={14} />
                    </Button>
                    <Button variant="secondary" disabled={busy} onClick={poll}>
                      {busy ? "Checking…" : "I approved — check connection"}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onClick={startPairing}
                    >
                      Get a new code
                    </Button>
                  </>
                ) : (
                  <Button disabled={busy} onClick={startPairing}>
                    {busy ? "Starting connection…" : "Connect your workspace"}
                    <ArrowUpRight size={14} />
                  </Button>
                )}
                <p className="muted text-sm">
                  Backend: {origin}. If pairing is denied, configure this exact
                  extension origin on the server:{" "}
                  <span className="mono">
                    {browser.runtime.getURL("").replace(/\/$/, "")}
                  </span>
                </p>
                <Button variant="secondary" onClick={() => open("/dashboard")}>
                  Open dashboard
                </Button>
              </>
            ) : busy ? (
              <Busy
                label={
                  view === "editor"
                    ? "Saving your report…"
                    : "Working with your evidence…"
                }
              />
            ) : view === "capture" ? (
              <>
                <button
                  className="extension-nav-back"
                  onClick={() => setView("home")}
                >
                  <ChevronLeft size={13} />
                  Capture home
                </button>
                <CapturePreview
                  capture={capture}
                  onChange={(c) => {
                    setCapture(c);
                    setReport(null);
                    setIssue(null);
                  }}
                  consent={consent}
                  onConsent={setConsent}
                  busy={busy}
                  onAnalyze={analyze}
                />
              </>
            ) : view === "editor" && report ? (
              <>
                <button
                  className="extension-nav-back"
                  onClick={() => setView("capture")}
                >
                  <ChevronLeft size={13} />
                  Review capture
                </button>
                {mode === "fallback" && (
                  <Notice>
                    Gemini is unavailable or the capture requires extra care.
                    This is an unanalyzed fallback; add verified details
                    yourself.
                  </Notice>
                )}
                <ProofEditor
                  report={report}
                  onChange={setReport}
                  disabled={
                    !!issue && !["draft", "failed"].includes(issue.status)
                  }
                />
                <span className="local-save">
                  {dirty
                    ? "Changes preserved on this device"
                    : "Saved to your workspace"}
                </span>
                <Button
                  disabled={
                    !dirty ||
                    (!!issue && !["draft", "failed"].includes(issue.status))
                  }
                  onClick={save}
                >
                  Save draft
                </Button>
                {issue && (
                  <>
                    <Button
                      variant="secondary"
                      disabled={dirty}
                      onClick={() => open(`/dashboard/issues/${issue.id}`)}
                    >
                      <Github size={15} />
                      Review &amp; publish in dashboard{" "}
                      <ArrowUpRight size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={dirty}
                      onClick={() =>
                        run(async () => {
                          const updated = await api.issue(issue.id);
                          setIssue(updated.issue);
                          setReport(updated.issue.report);
                          setNotice(
                            updated.issue.status === "published"
                              ? "Published on GitHub. Open the verified link below."
                              : `Current publication state: ${updated.issue.status}`,
                          );
                        })
                      }
                    >
                      Refresh publication status
                    </Button>
                    {issue.githubUrl && (
                      <Button asChild>
                        <a
                          href={safeExternal(issue.githubUrl)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Github size={15} />
                          Open GitHub issue #{issue.githubIssueNumber}
                        </a>
                      </Button>
                    )}
                    <p className="muted text-sm">
                      Repository selection, duplicate search, and final
                      publication use your secure dashboard session.
                    </p>
                  </>
                )}
              </>
            ) : view === "history" ? (
              <>
                <span className="eyebrow">YOUR RECENT WORK</span>
                <h2>Reports with context.</h2>
                <p className="muted text-sm">
                  Latest 100 saved reports. Open a report to inspect its current
                  GitHub status.
                </p>
                <h3>Local recovery drafts</h3>
                {localDrafts.length ? (
                  localDrafts.map((d) => (
                    <Button
                      key={d.id}
                      variant="secondary"
                      onClick={() => {
                        void remember().then(() => {
                          setCapture(d.capture);
                          setReport(d.report);
                          setIssue(d.issue);
                          setMode(d.mode);
                          setConsent(false);
                          setView(d.report ? "editor" : "capture");
                        });
                      }}
                    >
                      {d.report?.title ||
                        d.capture.pageTitle ||
                        "Captured evidence"}
                    </Button>
                  ))
                ) : (
                  <p className="muted text-sm">
                    No archived local drafts. Your current work is preserved
                    automatically.
                  </p>
                )}
                <h3>Saved account reports</h3>
                <IssueList
                  issues={issues}
                  href={(i) => `${origin}/dashboard/issues/${i.id}`}
                />
                {issues
                  .filter((i) => i.githubUrl)
                  .map((i) => (
                    <Button key={i.id} asChild variant="secondary">
                      <a
                        href={safeExternal(i.githubUrl!)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Github size={14} />
                        GitHub #{i.githubIssueNumber} · {i.report.title}
                      </a>
                    </Button>
                  ))}
                <Button
                  variant="secondary"
                  onClick={() => open("/dashboard/issues")}
                >
                  Open issue explorer
                </Button>
              </>
            ) : view === "settings" ? (
              <>
                <h2>Your workspace.</h2>
                <div className="session-info stack">
                  <Badge tone="mint">Connected · scoped session</Badge>
                  <span className="mono text-sm">{session.sessionId}</span>
                  <p className="muted text-sm">
                    Expires {new Date(session.expiresAt).toLocaleString()}.
                    Access is limited to analysis and draft read/write.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => open("/dashboard/settings")}
                >
                  Manage &amp; revoke sessions <ArrowUpRight size={14} />
                </Button>
                <Button variant="danger" onClick={() => setDisconnect(true)}>
                  Disconnect this device
                </Button>
                <Notice>
                  Revoke the session in dashboard settings before disconnecting.
                  Disconnecting clears this device’s token, pairing data, and
                  local draft. Your saved account reports remain available.
                </Notice>
                <h3>Privacy &amp; troubleshooting</h3>
                <p className="muted text-sm">
                  DevFlow reads selected text only after a toolbar action. It
                  does not read the DevTools console, browsing history, other
                  tabs, or local files. Review captured URLs and text before
                  sharing.
                </p>
                <Button
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard
                      .writeText(browser.runtime.getURL("").replace(/\/$/, ""))
                      .then(() => setNotice("Extension origin copied."))
                      .catch(() => setError("Clipboard unavailable."));
                  }}
                >
                  <Copy size={14} />
                  Copy extension origin
                </Button>
                <p className="muted text-sm">
                  Backend: {origin}. For capture permission errors, select text
                  again and click the toolbar icon. For expired sessions, pair
                  again.
                </p>
              </>
            ) : (
              <>
                <span className="eyebrow">
                  FROM BROWSER ERRORS TO VERIFIED ISSUES
                </span>
                <h1>
                  Keep the evidence.
                  <br />
                  Lose the busywork.
                </h1>
                <p className="muted">
                  Capture the error in front of you. Build a report someone can
                  act on.
                </p>
                <div className="capture-launch">
                  <MousePointer2 size={27} />
                  <h3>See an error? Start here.</h3>
                  <p>
                    Select relevant text on the page, then click the DevFlow
                    toolbar icon. That click grants temporary access to this
                    tab.
                  </p>
                  <Button onClick={recapture}>Capture issue</Button>
                  <span className="muted text-sm">
                    The panel button reuses an existing toolbar permission. If
                    it is unavailable, click the toolbar icon.
                  </span>
                </div>
                {capture.selectedText && (
                  <Button
                    variant="secondary"
                    onClick={() => setView(report ? "editor" : "capture")}
                  >
                    Continue local draft
                  </Button>
                )}
                <Button
                  variant="secondary"
                  onClick={() => {
                    void remember().then(() => {
                      setCapture(emptyCapture());
                      setReport(null);
                      setIssue(null);
                      setConsent(false);
                      setView("capture");
                    });
                  }}
                >
                  Enter evidence manually
                </Button>
                <Button variant="ghost" onClick={() => open("/dashboard")}>
                  Open dashboard <ArrowUpRight size={13} />
                </Button>
              </>
            )}
          </div>
        </Transition>
      </main>
      <footer className="extension-footer">
        <span>
          <ShieldCheck size={11} /> Human-reviewed by design
        </span>
        <span>DevFlow v0.1</span>
      </footer>
      <Confirm
        open={disconnect}
        onOpenChange={setDisconnect}
        title="Disconnect this device?"
        onConfirm={() => {
          void browser.storage.session
            .clear()
            .then(() =>
              browser.storage.local.remove([
                "workspace",
                "captureEvent",
                "localDrafts",
              ]),
            )
            .then(() => {
              setSession(null);
              setPairing(null);
              setCapture(emptyCapture());
              setReport(null);
              setIssue(null);
              setDisconnect(false);
              setView("home");
            });
        }}
        label="Disconnect"
      >
        First revoke this session in dashboard settings. This clears the local
        token and draft; it does not revoke the server session by itself.
      </Confirm>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Panel />
  </React.StrictMode>,
);
