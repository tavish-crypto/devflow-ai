"use client";
import { useState } from "react";
import { createApi, messageOf } from "@devflow/product/api";
import {
  Brand,
  Button,
  Confirm,
  Field,
  Notice,
  ShieldCheck,
  Badge,
} from "@devflow/product";
export default function Pairing() {
  const [code, setCode] = useState(""),
    [approved, setApproved] = useState(false),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function approve() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await createApi().confirmPairing(code);
      setApproved(true);
      setConfirm(false);
    } catch (e) {
      setError(messageOf(e));
      setConfirm(false);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <div className="auth-card stack">
        <a href="/">
          <Brand />
        </a>
        <Badge tone="mint">
          <ShieldCheck size={13} /> Secure device pairing
        </Badge>
        <h1>
          {approved
            ? "You’re connected."
            : "Your browser, meet your workspace."}
        </h1>
        {approved ? (
          <>
            <Notice tone="success">
              Return to the extension and check approval to complete pairing.
            </Notice>
            <Button asChild>
              <a href="/dashboard">Open dashboard</a>
            </Button>
          </>
        ) : (
          <>
            <p>
              Start pairing inside the DevFlow extension, then enter its
              eight-character code here. Only approve a code you can see in your
              own extension.
            </p>
            <Field label="Extension pairing code">
              <input
                className="pair-code mono"
                autoComplete="off"
                maxLength={8}
                value={code}
                placeholder="A1B2C3D4"
                onChange={(e) =>
                  setCode(
                    e.target.value.toUpperCase().replace(/[^A-F0-9]/g, ""),
                  )
                }
              />
            </Field>
            <Notice>
              This grants one hour of access to analyze captures and read or
              save drafts. GitHub publishing still requires approval in this
              dashboard.
            </Notice>
            {error && <Notice tone="error">{error}</Notice>}
            <Button
              disabled={!/^[A-F0-9]{8}$/.test(code)}
              onClick={() => setConfirm(true)}
            >
              Review connection
            </Button>
            <a href="/dashboard/settings" className="muted text-sm">
              Manage or revoke existing sessions
            </a>
          </>
        )}
        <Confirm
          open={confirm}
          onOpenChange={setConfirm}
          title="Approve this extension?"
          onConfirm={approve}
          busy={busy}
          label="Approve connection"
        >
          Verify that <strong className="mono">{code}</strong> matches the code
          displayed in your DevFlow extension. Do not approve codes sent to you
          by someone else.
        </Confirm>
      </div>
    </main>
  );
}
