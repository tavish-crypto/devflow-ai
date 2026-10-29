# Verification results

Implementation verification: 29 October 2026, Windows x64, pnpm 11.25.0. The default host runtime is Node 25.2.1; an official Node 24.11.0 LTS runtime is also used for the final compatibility pass. GitHub Actions targets Node 24 on Linux. Results below describe local execution unless otherwise stated.

| Command                                     | Result                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`            | Locked dependencies installed; reviewed Windows and Linux embedded PostgreSQL setup scripts allowlisted |
| `pnpm format:check`                         | Passed                                                                                                  |
| `pnpm lint`                                 | Passed                                                                                                  |
| `pnpm typecheck`                            | Shared contracts/product, Next.js, and WXT checks passed                                                |
| `pnpm test`                                 | **156 passed, 0 failed**, 16 files                                                                      |
| `pnpm test:db`                              | **35 passed**; isolated actual PostgreSQL migration/RLS/RPC checks with Supabase Auth boundary stubbed  |
| `pnpm build`                                | Next.js production and WXT Chrome MV3 builds passed                                                     |
| `DEVFLOW_TEST_CHANNEL=chrome pnpm test:e2e` | **9 passed, 0 failed**; dashboard, mobile, unpacked extension; no uncaught page errors                  |
| `node scripts/check-secrets.mjs`            | Passed after staging; no credential-like files or values staged                                         |
| `node scripts/check-browser-bundles.mjs`    | Passed: 48 built JS/JSON/HTML artifacts; no server-secret identifiers                                   |

## Coverage and what it proves

The inherited **98 backend tests** remain intact apart from updating the extension boundary test to the new side-panel entrypoint. The expanded suite checks typed transport validation, safe errors and cancellation, no automatic publish retry, stable UUID publication keys, capture permission/restricted/navigation failures, consent resets after redaction, original evidence vs AI provenance, escaped malicious content, disabled controls, duplicate candidates, auth guards/outages, user-filtered account metadata, confirmed disconnect, service-worker action order, and bounded local draft recovery.

The **35 database checks** use the actual migration and test ownership/RLS, browser denial on credentials/hash tables and service RPCs, atomic evidence writes, concurrent publication claims, unknown outcomes, idempotency, reconciliation, one-time pairing, token hashes, revocation, and expiry. They do not validate a hosted Supabase project.

Browser suites exercise protected routes, responsive layouts, safe demo interactions, consent → validated analysis → edit → save → repository → duplicate review → confirmation → single mocked publication → dashboard history; repeated confirmation clicks; local edit recovery; publication network errors; extension pairing through dashboard approval; the real browser extension action and selected-text injection; persisted editor state after worker-stop/reload; and dashboard handoff. External API responses are deterministic mocks. Auth uses an isolated test HTTP server without any application-side auth bypass.

Downloaded Chromium 156 and 141 both failed to launch on this Windows host with an OS side-by-side assembly error, before executing application code. Installed Chrome 156 supports the CDP extension load/action APIs and runs with a disposable profile. No system browser settings or real browsing profile were changed. The browser suite defaults to Chromium 156 via locked Playwright 1.64.1 on supported hosts.

Initial failures were investigated rather than skipped: Windows-unfriendly start scripts; Windows file-URL aliases for Vitest; workspace mock resolution; invalid fixture assumptions about summary search; fetch binding; missing direct extension Zod dependency; nullable session query data; WXT public-path typing; CSS token import ordering; and CDP action tab-target selection. No assertion was removed to obtain green results.

## Unverified live scenarios

Real Supabase magic-link delivery/hosted RLS, live Gemini analysis, real GitHub App authorization/publication/reconciliation, deployed origin configuration, production access reviews, and physical Chrome side-panel focus/resize ergonomics remain unverified. No live credentials were provisioned. The user’s test-issue authorization is recorded in this chat; no unnecessary public test issue was created.

Screenshots under `docs/screenshots` are rendered from the actual UI using labeled demo data/mocks. No production metrics or benchmark results are claimed. See BROWSER_TESTING for manual checks and DEMO for live verification.

The final compatibility pass used Node 24.11.0. The WXT build has a nonfatal 500 kB chunk-size advisory (approximately 770 kB total including fonts); it does not prevent build or browser operation. GitHub CI status is reported in the pull request, separately from these local results.

The initial push was rejected because the OAuth token lacks workflow scope. The workflow edit was removed from the unpublished commits, preserving the original workflow. Remote CI covers the expanded Vitest suite, database validation, type/lint/format/build checks, and source scan; browser verification and browser-bundle scanning were completed locally.
