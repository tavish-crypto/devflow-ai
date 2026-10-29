import {
  Brand,
  Button,
  Badge,
  ArrowRight,
  ArrowUpRight,
  MousePointer2,
  ShieldCheck,
  Fingerprint,
  Github,
  CheckCircle2,
  Sparkles,
} from "@devflow/product";
export default function Page() {
  return (
    <main className="landing">
      <nav className="landing-nav">
        <a href="/" aria-label="DevFlow home">
          <Brand />
        </a>
        <div>
          <a className="landing-privacy muted" href="#workflow">
            How it works
          </a>
          <a href="/login">Sign in</a>
          <Button asChild>
            <a href="/dashboard">
              Open workspace <ArrowUpRight size={14} />
            </a>
          </Button>
        </div>
      </nav>
      <section className="hero">
        <div>
          <Badge tone="violet">
            <Sparkles size={12} /> Your browser. Your evidence. Your call.
          </Badge>
          <h1>
            Great bug reports
            <br />
            start with <em>proof.</em>
          </h1>
          <p className="lead">
            Turn the error in front of you into a clear, evidence-backed GitHub
            issue. Capture, refine, and publish — without losing the context.
          </p>
          <div className="actions">
            <Button asChild>
              <a href="/login">
                Build your first ProofPack <ArrowRight size={16} />
              </a>
            </Button>
            <Button asChild variant="secondary">
              <a href="/demo">
                Explore the demo <ArrowUpRight size={14} />
              </a>
            </Button>
          </div>
          <span className="muted text-sm">
            <ShieldCheck size={13} /> Nothing leaves your browser until you
            approve.
          </span>
        </div>
        <div
          className="hero-visual"
          aria-label="Illustrative ProofPack preview, not live data"
        >
          <div className="demo-window">
            <div className="window-bar">
              <i />
              <i />
              <i />
              <span>PROOFPACK · ILLUSTRATIVE PREVIEW</span>
            </div>
            <div className="window-body">
              <Badge tone="mint">
                <Fingerprint size={12} /> Evidence captured
              </Badge>
              <h3>Checkout fails with an empty cart</h3>
              <p className="muted text-sm">
                A useful report. Every claim accounted for.
              </p>
              <pre>
                TypeError: Cannot read properties of undefined
                <br /> at Checkout.calculateTotal (checkout.tsx:42)
              </pre>
              <div className="proof-line">
                <span>Browser selection</span>
                <Badge tone="mint">Observed</Badge>
              </div>
              <div className="proof-line">
                <span>Summary &amp; priority</span>
                <Badge tone="violet">AI suggested</Badge>
              </div>
              <div className="proof-line">
                <span>Reproduction steps</span>
                <Badge>Developer entered</Badge>
              </div>
            </div>
          </div>
          <div className="hero-note">
            <CheckCircle2 size={21} />
            <div>
              <strong>Ready for a human review.</strong>
              <br />
              <span>No invented evidence. No automatic publishing.</span>
            </div>
          </div>
        </div>
      </section>
      <section className="feature-strip">
        <article className="feature">
          <MousePointer2 size={23} />
          <h3>Capture the moment</h3>
          <p>
            Select an error, click DevFlow, and keep the page context right
            beside your report.
          </p>
        </article>
        <article className="feature">
          <Fingerprint size={23} />
          <h3>Know what’s proven</h3>
          <p>
            ProofPack separates observed evidence, your notes, and unverified AI
            suggestions.
          </p>
        </article>
        <article className="feature">
          <Github size={23} />
          <h3>Publish with intention</h3>
          <p>
            Check possible duplicates, choose an authorized repository, and
            approve a real GitHub issue.
          </p>
        </article>
      </section>
      <section className="landing-flow" id="workflow">
        <span className="eyebrow">LESS CONTEXT SWITCHING. MORE CLARITY.</span>
        <h2>From “something broke” to something actionable.</h2>
        <div className="flow-line">
          <div>
            <Badge tone="violet">01</Badge>
            <h3>Capture &amp; redact</h3>
            <small>You choose exactly what to share.</small>
          </div>
          <ArrowRight size={18} />
          <div>
            <Badge tone="violet">02</Badge>
            <h3>Review your ProofPack</h3>
            <small>Gemini drafts. You verify.</small>
          </div>
          <ArrowRight size={18} />
          <div>
            <Badge tone="mint">03</Badge>
            <h3>Create a GitHub issue</h3>
            <small>A saved report with a real issue link.</small>
          </div>
        </div>
      </section>
      <footer className="landing-footer">
        <Brand />
        <span>Built by developers. Reviewed by you.</span>
        <a href="https://github.com/tavish-crypto/devflow-ai">
          View source <ArrowUpRight size={12} />
        </a>
      </footer>
    </main>
  );
}
