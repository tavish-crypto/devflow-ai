# Frontend/backend integration audit

The product branch retains Tavish’s shared schemas, database migration, authentication architecture, AI validation/fallback, repository authorization, publication transactions, and reconciliation logic. Original backend tests remain; the extension-boundary file reference now points to the implemented side panel.

| Concern             | Integration decision                                                                                                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared payloads     | Import `CaptureInput`, `IssueReport`, `Issue`, and Zod schemas from `@devflow/contracts`; no second JSON format                                                |
| Request validation  | Shared API client parses analysis/create/patch/publish/pairing/revoke inputs before fetch                                                                      |
| Response validation | All consumed success envelopes have Zod response validation; invalid JSON/schema data produces safe actionable errors                                          |
| Authentication      | Dashboard SSR cookies; extension `Authorization: Bearer df_…` with credentials omitted; no identity accepted from form fields                                  |
| Consent             | Capture input changes reset approval; backend still requires literal `consent:true`                                                                            |
| Scope mismatch      | Repository/duplicate/publish routes are intentionally dashboard-only. Extension saves a real draft and opens its dashboard detail, preserving scope boundaries |
| Publication         | The issue UUID is the stable idempotency key. Ref lock + disabled controls + confirmation prevent repeated UI submission; backend remains authoritative        |
| Uncertain response  | No automatic POST retry. Client marks publication uncertain, blocks controls, and offers server reload/reconciliation                                          |
| Reports             | Full form editing replaces the scaffold’s raw JSON editor; evidence remains separate and escaped                                                               |
| Repositories        | Only server-returned authorized repositories can be selected; server rechecks access before GitHub operations                                                  |
| Duplicate results   | Display actual issue number/title/link/state with “Possible match”; no calibrated confidence percentage                                                        |
| Query bounds        | API returns latest 100 issues; UI labels bounded counts and filters accurately                                                                                 |
| Draft persistence   | Account-scoped web recovery; extension local capture/editor/archive and session-only token storage                                                             |
| Production hosts    | Build-time exact HTTPS backend origin (localhost allowed for development); server exact-origin CORS remains unchanged                                          |

## Narrow backend additions and defects corrected

1. `GET /api/v1/account`: dashboard-only, validated auth, rate-limited, owner-filtered session metadata and connection status. Returns only email, session IDs/expiry/revocation, and a connection boolean. Hashes/tokens/encrypted credentials never leave the server. Session metadata is bounded to the latest 50 rows.
2. `POST /api/v1/github/disconnect`: dashboard-only, same-origin, strict `{confirmed:true}` body. Deletes only the authenticated user’s stored connection; it does not uninstall the GitHub App or delete reports. UI explains optional GitHub-side revocation.
3. `POST /auth/logout`: same-origin, server Supabase sign-out, redirects to login. Successful auth callback now redirects to the actual protected dashboard instead of the marketing page.
4. Dev/start scripts no longer use POSIX inline environment assignments, which failed on PowerShell. Preserve supported proxy behavior with `NODE_USE_ENV_PROXY` in the process environment when your deployment needs it.
5. Vitest aliases use `fileURLToPath`, resolving Windows drive paths correctly. Dependency mocks consistently resolve the same workspace Next/Supabase instances.
6. Reviewed Windows embedded PostgreSQL hydration script allowlisted alongside the inherited Linux binary. No integrity/TLS checks were disabled.
7. Pairing creation/exchange originally returned PostgreSQL timezone-offset strings, while the existing shared response contract requires UTC `Z` timestamps. Normalize expiry fields on the server (and new account metadata) before validation; regression tests supply real PostgreSQL-style offset values. This prevents a valid real pairing from being rejected by the typed client.

New account/disconnect ownership, confirmation, forged-field rejection, safe-error, and dashboard-scope tests are in `tests/backend/product-routes.test.ts`. Auth guards are tested in unit and browser suites.

## Browser verification approach

Playwright 1.64.1 uses Chromium 156. The unpacked extension is loaded with Chrome’s supported CDP `Extensions.loadUnpacked`; the toolbar path is invoked through `Extensions.triggerAction` on a **tab target**, with actual script injection and selection capture on an origin outside host permissions. These APIs are test harness capabilities only; the shipped extension requests no debugger permission.

Official references consulted: [Chrome action](https://developer.chrome.com/docs/extensions/reference/api/action), [Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel), [Playwright extension testing](https://playwright.dev/docs/chrome-extensions), and [Chrome DevTools Extensions protocol](https://github.com/ChromeDevTools/devtools-protocol/blob/master/pdl/domains/Extensions.pdl).

Live provider credentials were unavailable. Deterministic mocks establish frontend behavior and contract compatibility; they do not establish production service health, actual OAuth settings, or a successful live issue creation.
