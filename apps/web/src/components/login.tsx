"use client";
import { useState, type FormEvent } from "react";
import {
  Brand,
  Button,
  Field,
  Notice,
  ArrowRight,
  ShieldCheck,
} from "@devflow/product";
export default function Login() {
  const [email, setEmail] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ email }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await r.json();
      setFailed(!r.ok);
      setMessage(data.message);
    } catch {
      setFailed(true);
      setMessage(
        "We couldn’t send a sign-in link. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <div>
        <div className="auth-card">
          <a href="/">
            <Brand />
          </a>
          <h1>
            Your next great bug report
            <br />
            starts here.
          </h1>
          <p>
            Sign in to your private workspace with a secure email link. No
            password to remember.
          </p>
          <form className="stack" onSubmit={submit}>
            <Field label="Work email">
              <input
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Button disabled={busy}>
              {busy ? "Sending your link…" : "Send sign-in link"}
              <ArrowRight size={16} />
            </Button>
            {message && (
              <Notice tone={failed ? "error" : "success"}>{message}</Notice>
            )}
          </form>
          <p className="text-sm">
            <ShieldCheck size={14} /> Your reports are private to your account.
            After signing in, return to the extension approval page if you’re
            pairing.
          </p>
        </div>
        <div className="auth-footer">
          DevFlow AI · From browser errors to verified GitHub issues
        </div>
      </div>
    </main>
  );
}
