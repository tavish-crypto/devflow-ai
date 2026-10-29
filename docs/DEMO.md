# Demo and submission kit

## Preflight

Use the existing `/demo` React page. Its empty-cart checkout throws a harmless selectable TypeError; it makes no payment request or external mutation. Reset clears its cart and message. The source of the intentional bug is `apps/web/src/app/demo/page.tsx`; the displayed stack location is a demonstration stack, not an actual production telemetry claim.

Start the configured web app, load the extension build, sign in, install/authorize the GitHub App, pair, and verify repository access before presenting. Use a test repository with Issues enabled. This session authorizes **one live smoke-test issue in `tavish-crypto/devflow-ai` if needed**. Do not substitute a `gh issue create` command for the actual application workflow.

Live credentials have not been configured during this implementation. Until preflight succeeds, present mocked browser test results as mocked and avoid claiming a completed live demo.

## Two-minute pitch script

**0:00–0:25 — The problem.** “You’ve just seen an error in your browser. Before it becomes a useful GitHub issue, you have to copy the error, remember the page, explain the behavior, and work out whether someone has already reported it. Context gets lost in the handoff. DevFlow keeps that context attached.”

**0:25–0:55 — Capture and review.** “I select this checkout error and click DevFlow. The side panel captures only my selected text, page title, URL, and time. I can remove sensitive material and add what I expected. Nothing is sent for AI analysis until I approve this capture.”

**0:55–1:25 — ProofPack.** “Gemini helps draft the report. ProofPack shows the distinction between the original selection, my notes, and unverified generated fields. Missing behavior and reproduction steps stay visibly missing. I can edit every report field. We’re helping developers communicate evidence, while keeping them responsible for the final claims.”

**1:25–1:50 — A controlled GitHub handoff.** “I save the report, open the dashboard, choose an authorized repository, and inspect possible duplicate issues. Then I explicitly confirm publication. The returned GitHub link is attached to the saved report. If a network interruption makes the result uncertain, DevFlow reconciles the existing issue instead of blindly creating another.”

**1:50–2:00 — Close.** “The goal is a clear report with a traceable source, and a dependable path from a browser error to a developer who can fix it.”

## Four-minute live demo runbook

| Time      | Action and observable result                                                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:30 | Show `/demo`, empty cart, and Checkout. Select the visible TypeError. Explain the harmless intentional bug.                                                                                 |
| 0:30–1:00 | Click pinned extension icon. Show captured title/URL/selection/time. Remove sensitive material, enter notes: “Open demo, keep cart empty, press Checkout. Expected: explain cart is empty.” |
| 1:00–1:30 | Check consent and analyze. Show actual AI/fallback mode honestly. Point out observed, developer-entered, suggested, and missing labels.                                                     |
| 1:30–2:10 | Edit title to `[DevFlow smoke] Empty cart reaches total calculator`; fill actual/expected behavior and three verified steps. Review evidence and save.                                      |
| 2:10–2:50 | Open dashboard handoff. Select/save the authorized test repository. Run Duplicate Issue Radar and open an actual candidate if any; acknowledge distinctness.                                |
| 2:50–3:20 | Review publication confirmation and approve once. Show the returned real URL and issue number. If uncertain, stop and reconcile instead of retrying.                                        |
| 3:20–3:45 | Open the returned GitHub URL. Verify title/body and exactly one issue. Record the URL in the test report.                                                                                   |
| 3:45–4:00 | Return to dashboard overview/history and show the saved published report. Explain extension scopes and access revocation.                                                                   |

Suggested verification record: date, app commit SHA, account, repository, capture timestamp, analysis mode, created issue URL, issue count after repeated-click check, dashboard persisted state, and cleanup decision. Do not include session tokens or credentials. Close a test issue only when authorized by its owner; do not delete evidence of the smoke result.

## Judge Q&A

- **What makes the evidence trustworthy?** Provenance means exact user-supplied capture text retained separately from report edits. It does not certify the webpage, independently reproduce a bug, or prove an AI hypothesis.
- **What if Gemini invents a cause?** Generated fields are marked unverified. Server validation replaces model evidence with original quotes and clears unverified reproduction/cause/fix fields. The developer reviews the final report.
- **Does the extension read every tab or console log?** No. Capture is toolbar-triggered on the active tab, using selected text and page metadata. There is no console-reading mechanism, passive collection, or all-sites host permission.
- **Why publish from the dashboard?** The inherited backend deliberately limits extension sessions to analysis and draft access. GitHub operations require the validated dashboard session and an explicit final confirmation.
- **Can duplicate detection guarantee uniqueness?** No. The backend supplies lexical candidate matches. The UI shows “Possible match,” with actual issue links, rather than calibrated probabilities.
- **How do you prevent duplicate publication?** A stable issue UUID key, one UI operation at a time, database row locking, and persistent unknown states. A failed remote acknowledgement is reconciled, never automatically retried.
- **Where is data stored?** Device recovery in local extension/web storage; scoped token in trusted session storage; account records and original evidence privately in Supabase; published report content in the selected GitHub repository. Gemini receives the consented capture.
- **What is proven today?** Deterministic backend/frontend/database tests and real browser automation with mocked external services. Consult TEST_RESULTS for exact results. Live provider verification still requires credential setup.
- **What remains before production?** Hosted Auth/RLS acceptance, live OAuth/publication smoke, retention/deletion policy, edge abuse controls, CSP nonces, OAuth refresh/multiple installation UI, and physical accessibility acceptance.

## Benchmark protocol — no results claimed

Measure time from seeing a test error to a reviewed published issue with an accurate title, observed behavior, expected behavior, reproduction steps, source context, and correctly scoped repository. Compare a manual GitHub workflow with DevFlow using the same five harmless scenarios, randomized order, and at least three developers. Practice once before timing. Avoid reusing a known report from memory.

Record CSV columns: `participant,scenario,method,seconds,complete_fields,total_fields,incorrect_claims,duplicates_created,analysis_mode`. Record service/network failures and report medians plus spread; show report completeness and incorrect claims beside time. A reduction in time is useful only if report quality is maintained. Do not report hypothetical time savings as measured results.

Suggested scenarios: empty cart, a visible form validation error, a missing navigation destination, an out-of-date documentation snippet, and an intentionally displayed API error fixture. Run only against safe test apps and authorized issue repositories. Include setup time separately from the recurring task time.
