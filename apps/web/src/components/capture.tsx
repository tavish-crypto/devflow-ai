"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CaptureInputSchema,
  IssueReportSchema,
  type CaptureInput,
  type IssueReport,
} from "@devflow/contracts";
import {
  Button,
  Busy,
  CapturePreview,
  ProofEditor,
  Notice,
  Saved,
  Transition,
  ChevronLeft,
} from "@devflow/product";
import { createApi, messageOf } from "@devflow/product/api";
import { useIdentity } from "./workspace";
const api = createApi();
export default function Capture() {
  const router = useRouter(),
    user = useIdentity();
  const [capture, setCapture] = useState<CaptureInput>({
    pageTitle: "",
    url: "",
    selectedText: "",
    userNotes: "",
    capturedAt: new Date().toISOString(),
  });
  const [report, setReport] = useState<IssueReport | null>(null),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [mode, setMode] = useState(""),
    [ready, setReady] = useState(false);
  const lock = useRef(false),
    key = `devflow:capture:${user.id}`;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const data = JSON.parse(raw);
        const c = CaptureInputSchema.safeParse(data.capture);
        if (c.success) setCapture(c.data);
        const r = IssueReportSchema.safeParse(data.report);
        if (r.success) setReport(r.data);
      }
    } catch {
      /* Corrupt storage is ignored. */
    }
    setReady(true);
  }, [key]);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(key, JSON.stringify({ capture, report }));
      } catch {
        setError(
          "Device storage is full. Keep this page open until your draft is saved.",
        );
      }
  }, [capture, report, ready, key]);
  async function analyze() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await api.analyze({ capture, consent: consent as true });
      setReport(result.report);
      setMode(result.mode);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function save() {
    if (lock.current || !report) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await api.create({ capture, report });
      localStorage.removeItem(key);
      router.push(`/dashboard/issues/${result.issue.id}`);
    } catch (e) {
      setError(messageOf(e));
      lock.current = false;
      setBusy(false);
    }
  }
  if (!ready) return <Busy />;
  return (
    <Transition>
      <div className="capture-workspace">
        <a className="back-link" href="/dashboard/issues">
          <ChevronLeft size={14} />
          All issues
        </a>
        <div className="page-heading">
          <div>
            <h1>A report worth opening.</h1>
            <p>Start with evidence. Keep the final say.</p>
          </div>
          <Saved dirty />
        </div>
        {error && (
          <div className="mb-5">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
        <div className="panel">
          <div className="panel-body">
            {busy ? (
              <Busy
                label={
                  report
                    ? "Saving your draft…"
                    : "Reading evidence and validating your report…"
                }
              />
            ) : report ? (
              <div className="stack">
                {mode === "fallback" && (
                  <Notice>
                    Gemini is unavailable or the capture needs extra care. This
                    is an unanalyzed fallback. Fill in the report from your
                    evidence.
                  </Notice>
                )}
                <ProofEditor report={report} onChange={setReport} />
                <div className="actions">
                  <Button onClick={save}>
                    Save draft &amp; review publication
                  </Button>
                  <Button variant="secondary" onClick={() => setReport(null)}>
                    Back to capture
                  </Button>
                </div>
              </div>
            ) : (
              <CapturePreview
                capture={capture}
                onChange={setCapture}
                consent={consent}
                onConsent={setConsent}
                busy={busy}
                onAnalyze={analyze}
              />
            )}
          </div>
        </div>
        <p className="footer-hint">
          Unsaved work is preserved on this browser, scoped to your account.
        </p>
      </div>
    </Transition>
  );
}
