# Browser verification

## Reproduce automation

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm exec playwright install --with-deps chromium
pnpm test:e2e
```

The harness starts the built Next application and an isolated local fake Supabase Auth HTTP provider. API responses are intercepted per browser context and validated by the actual frontend client. No real service credentials, real user cookies, hosted database, or production auth bypass are used. Existing servers on port 3000 are not silently reused. Port 45451 is reserved for the test Auth stub.

Playwright 1.64.1/Chromium 156 is pinned because the extension suite uses official CDP extension load/action commands. It creates a disposable persistent context, loads the built extension, opens the actual side-panel document, completes pairing through the dashboard, selects text on `127.0.0.1` (outside the `localhost` backend host permission), triggers the extension action on the tab target, and verifies the real captured text. The suite requests worker stopping before a panel reload and checks editor recovery. It then saves a draft and opens its dashboard detail.

Windows host fallback:

```powershell
$env:DEVFLOW_TEST_CHANNEL='chrome'
pnpm test:e2e
```

The fallback uses a fresh profile of installed Chrome, never the user’s normal profile. On the implementation host, bundled Chromium cannot start because Windows reports its versioned dependent assembly unavailable. Installed Chrome 156 successfully supports the required CDP APIs. If your installed Chrome lacks these commands, use bundled Chromium on a supported host or a Linux runner; do not weaken the tests.

Screenshots are regenerated into `docs/screenshots` with an explicit demo-data/mock-services label. HTML reports/traces go to ignored `playwright-report` and `test-results` directories. The inherited GitHub workflow remains unchanged because the authenticated token lacks workflow scope. It runs the expanded unit suite, database checks, type checks, lint/format, builds, and source secret scan. Browser tests and report uploads are not added to remote CI in this branch; run the commands above locally or add a browser job later using an appropriately scoped token.

## Manual Chrome acceptance checklist

Automation verifies capture through the browser action API and the actual panel document. Physical toolbar interactions, Chrome’s panel resize behavior, screen-reader output, and assistive keyboard behavior still need a human pass:

1. Load the unpacked build, pin the icon, configure the exact backend/extension origins, log in, install/authorize GitHub, and pair using the visible matching code.
2. Open `/demo` in a normal tab, keep the cart empty, press Checkout, select the displayed TypeError, and physically click DevFlow’s pinned icon. Confirm Chrome’s side panel opens with exactly that selection/title/URL.
3. Resize the panel to 320px and 380px. Tab through every input, toggle consent with Space, navigate confirmation with Tab/Shift+Tab, cancel with Escape, and verify visible focus. Repeat with reduced motion enabled.
4. Clear the selection and recapture. Confirm manual-entry guidance. Repeat on `chrome://settings`, a Chrome Web Store page, a closed tab, and a page navigating during capture. No unrelated tabs should be read.
5. Begin editing, close/reopen the panel, suspend its worker through Chrome’s extension service-worker inspector, then reopen. Confirm recovery. Trigger a second capture and recover the first report from local History.
6. Redact a credential-like string and private URL query. Confirm edits clear consent. Verify no analysis request in Network before approval. With Gemini unavailable, verify the unanalyzed fallback label.
7. Save a draft, open it in dashboard, choose and save an authorized repository, inspect duplicate links, acknowledge distinctness, and cancel the publish confirmation. Confirm no issue appears on GitHub after canceling.
8. With explicit live-test authorization, publish once. Rapidly click the confirmation twice. Verify one GitHub issue, returned issue number/URL, matching report body, and persisted dashboard status.
9. Interrupt publication after sending. Confirm UI blocks blind resubmission, reloads server state, and offers reconciliation after the stale-claim interval. Never issue a replacement POST while outcome is unknown.
10. Revoke the extension’s session in settings. Its next API request must return unauthorized and request re-pairing. Confirm captures remain local until deliberately disconnected/cleared.
11. Use another account to verify the first account’s drafts, sessions, evidence, and GitHub connection are invisible. Test this against actual Supabase as well as mocks before production.

Live acceptance is pending service credentials. Record actual results in TEST_RESULTS; do not infer a live pass from mocked automation.
