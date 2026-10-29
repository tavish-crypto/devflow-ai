"use client";
import { useEffect, useState } from "react";
import type { Repository } from "@devflow/contracts";
import { createApi, messageOf } from "@devflow/product/api";
import {
  Badge,
  Button,
  Busy,
  Confirm,
  Empty,
  Github,
  FolderGit2,
  Notice,
  ShieldCheck,
  Transition,
  LogOut,
  ArrowUpRight,
  Toast,
} from "@devflow/product";
import { useIdentity } from "./workspace";
const api = createApi();
type AccountData = Awaited<ReturnType<typeof api.account>>;
export default function Account({
  view,
}: {
  view: "integrations" | "settings";
}) {
  const identity = useIdentity();
  const [account, setAccount] = useState<AccountData | null>(null),
    [repos, setRepos] = useState<Repository[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [repoError, setRepoError] = useState(""),
    [confirm, setConfirm] = useState(""),
    [busy, setBusy] = useState(false),
    [reload, setReload] = useState(0),
    [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      api.account().then((d) => {
        if (active) setAccount(d);
      }),
      api
        .repositories()
        .then((d) => {
          if (active) {
            setRepos(d.repositories);
            setRepoError("");
          }
        })
        .catch((e) => {
          if (active) setRepoError(messageOf(e));
        }),
    ])
      .catch((e) => {
        if (active) setError(messageOf(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reload]);
  async function act() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (confirm === "local") {
        Object.keys(localStorage)
          .filter(
            (k) =>
              k === `devflow:capture:${identity.id}` ||
              k.startsWith(`devflow:issue:${identity.id}:`),
          )
          .forEach((k) => localStorage.removeItem(k));
        setMessage("Local recovery drafts cleared from this device.");
      } else if (confirm === "github") {
        await api.disconnect();
        setMessage(
          "GitHub disconnected from DevFlow. You can also revoke the App in GitHub settings.",
        );
      } else {
        await api.revoke(confirm);
        setMessage("Extension access revoked.");
      }
      setConfirm("");
      setReload(reload + 1);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Transition>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {view === "integrations"
              ? "CONNECTED TO YOUR WORKFLOW"
              : "YOUR ACCOUNT, YOUR CONTROL"}
          </span>
          <h1 className="mt-2">
            {view === "integrations"
              ? "A direct line to GitHub."
              : "Workspace settings."}
          </h1>
          <p>
            {view === "integrations"
              ? "Authorize only the repositories you want DevFlow to work with."
              : "Manage access and understand how your evidence is handled."}
          </p>
        </div>
      </div>
      {loading ? (
        <Busy />
      ) : (
        <div className="stack">
          {error && (
            <Notice tone="error">
              {error}
              <Button variant="secondary" onClick={() => setReload(reload + 1)}>
                Retry
              </Button>
            </Notice>
          )}
          <Toast message={message} onDismiss={() => setMessage("")} />
          {view === "integrations" ? (
            <>
              <section className="panel">
                <div className="panel-header">
                  <h3>
                    <Github size={20} /> GitHub App
                  </h3>
                  <Badge tone={account?.githubConnected ? "mint" : "amber"}>
                    {account?.githubConnected ? "Connected" : "Not connected"}
                  </Badge>
                </div>
                <div className="panel-body stack">
                  <p className="muted">
                    Install the App on selected repositories, then authorize
                    your GitHub account. DevFlow requests metadata read access
                    and issue read/write access.
                  </p>
                  <div className="actions">
                    <Button asChild>
                      <a href="/api/github/install">
                        <Github size={16} />
                        Install on GitHub <ArrowUpRight size={14} />
                      </a>
                    </Button>
                    <Button asChild variant="secondary">
                      <a href="/api/github/authorize">
                        {account?.githubConnected
                          ? "Reconnect account"
                          : "Authorize account"}
                      </a>
                    </Button>
                    {account?.githubConnected && (
                      <Button
                        variant="danger"
                        onClick={() => setConfirm("github")}
                      >
                        Disconnect
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      onClick={() => setReload(reload + 1)}
                    >
                      Refresh repositories
                    </Button>
                  </div>
                </div>
              </section>
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h3>Authorized repositories</h3>
                    <p>GitHub operations recheck your installation access.</p>
                  </div>
                  <Badge>{repos.length}</Badge>
                </div>
                {repoError ? (
                  <div className="panel-body">
                    <Notice tone="error">{repoError}</Notice>
                  </div>
                ) : repos.length ? (
                  repos.map((r) => (
                    <div key={r.fullName} className="repo-card">
                      <FolderGit2 size={19} />
                      <div className="flex-1">
                        <strong>{r.fullName}</strong>
                        <br />
                        <small>Issues read/write · metadata read</small>
                      </div>
                      <Badge>{r.private ? "Private" : "Public"}</Badge>
                    </div>
                  ))
                ) : (
                  <Empty title="Choose your repositories">
                    Install the GitHub App and authorize your account to see
                    accessible repositories.
                  </Empty>
                )}
              </section>
            </>
          ) : (
            <div className="settings-grid">
              <div className="stack">
                <section className="panel">
                  <div className="panel-header">
                    <h3>Account</h3>
                    <Badge tone="mint">Signed in</Badge>
                  </div>
                  <div className="panel-body stack">
                    <p>{identity.email}</p>
                    <p className="muted text-sm">
                      Secure magic-link sign-in through Supabase.
                    </p>
                    <form action="/auth/logout" method="post">
                      <Button variant="secondary">
                        <LogOut size={15} />
                        Sign out
                      </Button>
                    </form>
                  </div>
                </section>
                <section className="panel">
                  <div className="panel-header">
                    <h3>Extension sessions</h3>
                    <Button asChild variant="ghost">
                      <a href="/connect-extension">Pair extension</a>
                    </Button>
                  </div>
                  <div className="panel-body">
                    {account?.sessions.length ? (
                      account.sessions.map((s) => (
                        <div key={s.id} className="session-row">
                          <div>
                            <strong className="mono text-sm">
                              {s.id.slice(0, 8)}
                            </strong>
                            <br />
                            <small>
                              {s.revokedAt
                                ? "Revoked"
                                : Date.parse(s.expiresAt) < Date.now()
                                  ? "Expired"
                                  : `Expires ${new Date(s.expiresAt).toLocaleString()}`}
                            </small>
                          </div>
                          {!s.revokedAt &&
                            Date.parse(s.expiresAt) > Date.now() && (
                              <Button
                                variant="danger"
                                onClick={() => setConfirm(s.id)}
                              >
                                Revoke
                              </Button>
                            )}
                        </div>
                      ))
                    ) : (
                      <p className="muted">No extension sessions.</p>
                    )}
                  </div>
                </section>
              </div>
              <section className="panel">
                <div className="panel-header">
                  <h3>
                    <ShieldCheck size={17} /> Privacy by intention
                  </h3>
                </div>
                <div className="panel-body stack">
                  <p className="muted">
                    Capture is triggered by you. Only selected text, the page
                    title, URL, timestamp, and your notes are collected.
                  </p>
                  <p className="muted">
                    Reviewed evidence goes to Gemini only after your consent.
                    Reports and original evidence are saved privately in
                    Supabase. Publishing shares report content with the selected
                    GitHub repository.
                  </p>
                  <p className="muted">
                    Local recovery drafts stay in this browser and are scoped to
                    your account. To clear them from this device, use the button
                    below. Server drafts are unaffected.
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() => setConfirm("local")}
                  >
                    Clear local recovery drafts
                  </Button>
                  <p className="muted text-sm">
                    Need help? Check the repository’s setup and troubleshooting
                    guide. For multiple GitHub installations, the current
                    backend requires an installation ID in the OAuth callback.
                  </p>
                  <a
                    className="inline-link"
                    href="https://github.com/tavish-crypto/devflow-ai#readme"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Setup &amp; troubleshooting <ArrowUpRight size={13} />
                  </a>
                </div>
              </section>
            </div>
          )}
        </div>
      )}
      <Confirm
        open={!!confirm}
        onOpenChange={(v) => {
          if (!v) setConfirm("");
        }}
        title={
          confirm === "local"
            ? "Clear local recovery drafts?"
            : confirm === "github"
              ? "Disconnect GitHub?"
              : "Revoke extension access?"
        }
        onConfirm={act}
        busy={busy}
        label={
          confirm === "local"
            ? "Clear local drafts"
            : confirm === "github"
              ? "Disconnect"
              : "Revoke access"
        }
      >
        {confirm === "local"
          ? "Unsaved reports stored on this browser will be removed. Save any important changes to your account first. Server reports are preserved."
          : confirm === "github"
            ? "This removes DevFlow’s stored GitHub connection. Existing reports are preserved. Reauthorize to publish again."
            : "This session will immediately lose API access. Pair the extension again to reconnect."}
      </Confirm>
    </Transition>
  );
}
