"use client";
import { useId, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Slot } from "@radix-ui/react-slot";
import * as Dialog from "@radix-ui/react-dialog";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowUpRight,
  Check,
  Code2,
  ExternalLink,
  Fingerprint,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import type { CaptureInput, Issue, IssueReport } from "@devflow/contracts";
export {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Fingerprint,
  FolderGit2,
  Github,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  MousePointer2,
  PanelLeftClose,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Workflow,
  X,
  Zap,
} from "lucide-react";

// shadcn/ui composition: Radix primitives with product-owned styles.
export function Button({
  asChild,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={`button ${variant} ${className}`} {...props} />;
}
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <span className="brand-mark">
        <Code2 size={21} />
      </span>
      {!compact && (
        <>
          DevFlow<span className="brand-ai">AI</span>
        </>
      )}
    </span>
  );
}
export function Transition({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      {children}
    </motion.div>
  );
}
export function Busy({
  label = "Loading your workspace…",
}: {
  label?: string;
}) {
  return (
    <div className="loading" role="status">
      <LoaderCircle size={20} className="spin" />
      <span>{label}</span>
      <div className="skeleton" />
      <div className="skeleton short" />
    </div>
  );
}
export function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "error" | "success";
}) {
  return (
    <div
      className={`notice ${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
export function Toast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return message ? (
    <div className="product-toast" role="status">
      <Check size={16} />
      <span>{message}</span>
      <button
        className="icon-button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
      >
        <X size={15} />
      </button>
    </div>
  ) : null;
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Fingerprint size={30} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Badge({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Status({ status }: { status: Issue["status"] }) {
  return (
    <Badge
      tone={
        status === "published"
          ? "mint"
          : status === "draft"
            ? "violet"
            : "amber"
      }
    >
      {status === "publish_unknown"
        ? "Needs reconciliation"
        : status.replaceAll("_", " ")}
    </Badge>
  );
}
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {hint && <span className="field-hint">{hint}</span>}
      </label>
      <Slot id={id}>{children}</Slot>
    </div>
  );
}
export function Confirm({
  open,
  onOpenChange,
  title,
  children,
  onConfirm,
  busy,
  label = "Confirm",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  children: ReactNode;
  onConfirm: () => void;
  busy?: boolean;
  label?: string;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!busy) onOpenChange(v);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog-content"
          onEscapeKeyDown={(e) => {
            if (busy) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (busy) e.preventDefault();
          }}
        >
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description asChild>
            <div className="dialog-description">{children}</div>
          </Dialog.Description>
          <div className="actions">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button disabled={busy} onClick={onConfirm}>
              {busy ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <ShieldCheck size={16} />
              )}
              {busy ? "Working…" : label}
            </Button>
          </div>
          <Dialog.Close asChild>
            <button
              className="dialog-close icon-button"
              disabled={busy}
              aria-label="Close confirmation"
            >
              <X size={18} />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function CapturePreview({
  capture,
  onChange,
  consent,
  onConsent,
  busy,
  onAnalyze,
}: {
  capture: CaptureInput;
  onChange: (c: CaptureInput) => void;
  consent: boolean;
  onConsent: (c: boolean) => void;
  busy: boolean;
  onAnalyze: () => void;
}) {
  const change = (key: keyof CaptureInput, value: string) => {
    onConsent(false);
    onChange({ ...capture, [key]: value });
  };
  return (
    <section className="capture-preview stack">
      <div className="section-heading">
        <span className="eyebrow">01 / CAPTURE</span>
        <Badge tone="mint">
          <ShieldCheck size={12} /> Private until you approve
        </Badge>
      </div>
      <h2>Start with what happened.</h2>
      <p className="muted">
        Review your selection. Remove credentials, personal data, and private
        URLs before continuing.
      </p>
      <p className="muted text-sm">
        Captured {new Date(capture.capturedAt).toLocaleString()}
      </p>
      <div className="grid-2">
        <Field label="Page title">
          <input
            maxLength={500}
            value={capture.pageTitle}
            onChange={(e) => change("pageTitle", e.target.value)}
            placeholder="Checkout · My app"
          />
        </Field>
        <Field label="Source URL">
          <input
            type="url"
            maxLength={2048}
            value={capture.url}
            onChange={(e) => change("url", e.target.value)}
            placeholder="https://your-app.example/checkout"
          />
        </Field>
      </div>
      <Field
        label="Selected evidence"
        hint={`${capture.selectedText.length.toLocaleString()} / 16,000`}
      >
        <textarea
          className="code-input"
          rows={6}
          maxLength={16000}
          value={capture.selectedText}
          onChange={(e) => change("selectedText", e.target.value)}
          placeholder="Paste the error or select text on a webpage…"
        />
      </Field>
      <Field label="Your notes" hint="Optional · developer entered">
        <textarea
          rows={3}
          maxLength={4000}
          value={capture.userNotes ?? ""}
          onChange={(e) => change("userNotes", e.target.value)}
          placeholder="What did you expect? How can someone reproduce this?"
        />
      </Field>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => onConsent(e.target.checked)}
        />
        I reviewed this capture and approve sending it to Gemini for analysis.
      </label>
      <Button
        onClick={onAnalyze}
        disabled={
          busy ||
          !consent ||
          !capture.selectedText.trim() ||
          !/^https?:\/\//.test(capture.url)
        }
      >
        <Sparkles size={16} />
        {busy ? "Analyzing evidence…" : "Build my ProofPack"}
        <ArrowUpRight size={16} />
      </Button>
    </section>
  );
}

const texts = [
  ["summary", "Summary", 4000],
  ["actualBehavior", "Actual behavior", 4000],
  ["expectedBehavior", "Expected behavior", 4000],
  ["possibleCause", "Possible cause", 2000],
  ["suggestedFix", "Suggested fix", 2000],
] as const;
export function ProofEditor({
  report,
  onChange,
  disabled = false,
}: {
  report: IssueReport;
  onChange: (r: IssueReport) => void;
  disabled?: boolean;
}) {
  function edit(key: keyof IssueReport, value: unknown) {
    onChange({
      ...report,
      [key]: value,
      aiFields: report.aiFields.filter((f) => f !== key),
    });
  }
  const provenance = (key: string, present: boolean) => (
    <Badge
      tone={
        present ? (report.aiFields.includes(key) ? "violet" : "mint") : "amber"
      }
    >
      {present
        ? report.aiFields.includes(key)
          ? "Gemini suggestion · unverified"
          : "Developer entered"
        : "Missing / unverified"}
    </Badge>
  );
  return (
    <div className="proof-editor stack">
      <div className="section-heading">
        <span className="eyebrow">02 / PROOFPACK</span>
        <span className="muted text-sm">
          <Fingerprint size={14} /> Evidence before inference
        </span>
      </div>
      <fieldset disabled={disabled} className="stack">
        <Field label="Issue title" hint={provenance("title", !!report.title)}>
          <input
            maxLength={200}
            value={report.title}
            onChange={(e) => edit("title", e.target.value)}
          />
        </Field>
        <div className="grid-2">
          <Field label="Type" hint={provenance("issueType", true)}>
            <select
              value={report.issueType}
              onChange={(e) => edit("issueType", e.target.value)}
            >
              <option value="bug">Bug</option>
              <option value="task">Task</option>
              <option value="docs">Documentation</option>
            </select>
          </Field>
          <Field label="Priority" hint={provenance("priority", true)}>
            <select
              value={report.priority}
              onChange={(e) => edit("priority", e.target.value)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </Field>
        </div>
        {texts.map(([key, label, limit]) => (
          <Field key={key} label={label} hint={provenance(key, !!report[key])}>
            <textarea
              rows={key === "summary" ? 3 : 2}
              maxLength={limit}
              value={report[key] ?? ""}
              placeholder="Add verified details, or leave unknown"
              onChange={(e) =>
                edit(key, e.target.value || (key === "summary" ? "" : null))
              }
            />
          </Field>
        ))}
        <Field
          label="Reproduction steps"
          hint={provenance(
            "reproductionSteps",
            report.reproductionSteps.length > 0,
          )}
        >
          <textarea
            rows={4}
            value={report.reproductionSteps.join("\n")}
            placeholder="One verified step per line"
            onChange={(e) =>
              edit(
                "reproductionSteps",
                e.target.value ? e.target.value.split("\n") : [],
              )
            }
          />
        </Field>
        <Field
          label="Missing information"
          hint="One item per line · remove when verified"
        >
          <textarea
            rows={3}
            value={report.missingInformation.join("\n")}
            onChange={(e) =>
              edit(
                "missingInformation",
                e.target.value ? e.target.value.split("\n") : [],
              )
            }
          />
        </Field>
      </fieldset>
      <section className="evidence-panel">
        <h3>
          <ShieldCheck size={17} /> Original evidence
        </h3>
        <p className="muted text-sm">
          Captured quotes remain separate from the editable report. AI
          suggestions are never observed evidence.
        </p>
        {report.evidence.map((e, i) => (
          <div key={i} className="evidence">
            <Badge tone={e.source === "observed" ? "mint" : "muted"}>
              {e.source === "observed"
                ? "Observed selection"
                : "Developer note"}
            </Badge>
            <pre>{e.content}</pre>
          </div>
        ))}
      </section>
    </div>
  );
}
export function IssueList({
  issues,
  href,
  emptyAction,
}: {
  issues: Issue[];
  href: (i: Issue) => string;
  emptyAction?: ReactNode;
}) {
  if (!issues.length)
    return (
      <Empty title="A clear workspace. A good start." action={emptyAction}>
        Capture an error in your browser, or start with a manual report.
      </Empty>
    );
  return (
    <div className="issue-list">
      {issues.map((i) => (
        <a
          className="issue-row"
          href={href(i)}
          target={href(i).startsWith("http") ? "_blank" : undefined}
          rel={href(i).startsWith("http") ? "noreferrer" : undefined}
          key={i.id}
        >
          <span
            className={`issue-priority ${i.report.priority}`}
            title={`${i.report.priority} priority`}
          />
          <div className="issue-row-main">
            <strong>{i.report.title}</strong>
            <span>
              {i.repoOwner
                ? `${i.repoOwner}/${i.repoName}`
                : "No repository selected"}{" "}
              <span aria-hidden="true">·</span>{" "}
              {new Date(i.updatedAt).toLocaleDateString()}
            </span>
          </div>
          <Status status={i.status} />
          <ExternalLink className="row-arrow" size={15} />
        </a>
      ))}
    </div>
  );
}
export function Duplicates({
  candidates,
}: {
  candidates: { number: number; title: string; url: string; state: string }[];
}) {
  return (
    <section className="stack">
      <h3>Duplicate Issue Radar</h3>
      <p className="muted text-sm">
        Lexical matches are suggestions. Review these issues before deciding
        your report is distinct.
      </p>
      {candidates.length ? (
        candidates.map((c) => (
          <a
            key={c.number}
            className="duplicate"
            href={safeExternal(c.url)}
            target="_blank"
            rel="noreferrer"
          >
            <Badge tone="amber">Possible match</Badge>
            <strong>
              #{c.number} {c.title}
            </strong>
            <span className="muted">
              {c.state} <ArrowUpRight size={14} />
            </span>
          </a>
        ))
      ) : (
        <Notice>
          No possible matches returned. This does not guarantee there are no
          duplicates.
        </Notice>
      )}
    </section>
  );
}
export function safeExternal(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === "github.com"
      ? u.href
      : "#";
  } catch {
    return "#";
  }
}
export function Saved({ dirty }: { dirty: boolean }) {
  return (
    <span className={`save-state ${dirty ? "muted" : "mint-text"}`}>
      {!dirty && <Check size={13} />}
      {dirty ? "Unsaved changes · preserved on this device" : "Saved"}
    </span>
  );
}
