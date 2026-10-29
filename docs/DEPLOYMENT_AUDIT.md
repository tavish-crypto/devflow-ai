# Deployment audit — blocked release candidate

Audited candidate: **fefc3269459a28221f7b4005e9504f32fa7185b0** on `chore/deployment-readiness`.
Candidate Git tree: `2e6e8827d034a390baeb3c32b422d4547867cd62`.
Integrated base: `d506e4c18648ee5e7c6c88622122dbd4f5712da0` (main; Kartik PR #2 and Tavish PR #1 included).

Decision: **do not deploy or promote to production yet**. No production deployment exists from this task. Vercel authentication, service credentials, hosted migrations/Auth settings, live Gemini/GitHub App checks and the complete extension acceptance test remain unresolved. Local passing tests do not waive these gates.

This audit applies to the candidate above. The follow-up audit/report commit changes documentation only; deploy the audited candidate or rerun required checks against a newer runtime/configuration commit. No release tag was created. Existing authorship/history is preserved; no main push or force push.

## Evidence

- Node 24.19.0, pnpm 11.25.0; frozen installation, formatting, lint, all workspace type checks pass.
- **167 unit tests pass**, 17 files; **35 local PostgreSQL checks pass** with actual migration and Supabase Auth schema/role stubs.
- Next.js production build and MV3 worker/side-panel build pass. Local production HTTP smoke: **6 checks pass**.
- Browser run using system Chromium 154: **8 passed, 1 failed due to host policy**. The unpacked-extension scenario fails at `Extensions.loadUnpacked`: “Loading of unpacked extensions is disabled by the administrator.” Its capture/analysis/persistence workflow did not execute. Do not bypass that policy.
- Pinned Chromium 156 download: HTTP 403 “Domain forbidden” from cdn.playwright.dev. No checksum/TLS checks were weakened. An earlier run was intentionally interrupted while build completion was being coordinated; it is not a passed run.
- Source secret-pattern scan passes (test fixtures/lockfile excluded). Browser boundary scan passes for **46 artifacts**. These are pattern/identifier checks, not a security certification.
- Vercel CLI 65.7.0: whoami reports logged out. Device login fails with fetch failed, including after routing Node through the session proxy. No temporary/unclaimed deployment was created.
- Required application/deployment variables and standard Vercel/Supabase login locations are absent. Cloud metadata reports no configured application secrets/outbound identities.
- Git fetch/read works through existing Git HTTPS proxy. This does not establish application GitHub App authorization.

## Security review

Existing consent, strict shared schemas, streamed 64KB JSON limits, validated user identity, ownership filters, server-only credentials, RLS, hashed scoped sessions, one-use pairing, exact CORS, CSRF checks, escaped display, repository-scoped tokens, transactional publish claims and unknown-outcome reconciliation remain intact. The tests cover these boundaries using deterministic provider mocks and isolated PostgreSQL.

No provider/admin credential identifiers were found in built browser artifacts. No model tools, arbitrary capture URL fetches or remote execution were introduced. No real GitHub issue was created. The separate production configuration check prints names and status only, validates exact HTTPS origins and cryptographic key shape, and correctly fails when configuration is missing. Production extension packaging refuses a missing/localhost origin. Its live-origin success path remains unverified without a verified backend.

Reviewed migration SHA256: `9a5ca25b465ea43b892ddaf40b5b8e5942bd741cb55f3a9acb99cb153533ef34`. Remote migration history was not available, so no hosted SQL or Auth configuration was changed. Compare the real schema/history before any application; never run CREATE statements blindly against an unknown production database.

Known limitations remain: global public rate buckets require trusted-edge throttling; production CSP still permits inline hydration scripts/styles; GitHub OAuth refresh and multi-installation selection require future work; retention policies and actual deployed two-user isolation need verification. The extension has a nonfatal >500KB chunk advisory and uses default Chrome icon styling (no custom icon pack).

## Safe changes made

- apps/web/vercel.json sets Next framework, frozen install, build command and .next output; project root must be apps/web in the real Vercel project. Node 24.x is explicit.
- release:preflight lists missing application variables without values and validates production-safe shapes; it does not claim provider readiness.
- package:extension requires a verified HTTPS backend, builds/archives through WXT, validates the exact host/worker/panel manifest and creates archive checksums. No production archive has been generated.
- Optional DEVFLOW_TEST_EXECUTABLE_PATH supports an installed test browser without removing assertions, scopes or security controls.
- ESLint ignores generated Playwright reports/test output/local artifacts. This fixes linting of downloaded/minified report JavaScript after browser execution; source lint rules remain enabled.

See PRODUCTION_DEPLOYMENT_REPORT.md for exact commands, external blockers and manual prerequisites.
