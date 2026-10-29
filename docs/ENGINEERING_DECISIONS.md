# Engineering decisions

- Use the existing isolated checkout on feat/tavish-core; no worktree and no main/force push.
- Node 24 LTS, pnpm 11.25.0, strict TypeScript 6.0.3, Next 16.4.3, React 19.3.1, official Gen AI 2.32.0, Supabase SSR 0.12.7 / JS 2.118.0, Zod 4.6.7, Vitest 5.0.5. Versions were resolved through the official registry and locked. Typescript 6 is intentionally selected over latest 7 for ecosystem compatibility. ESLint 9 remains on the compatible typescript-eslint configuration; npm reports its support deprecation, so schedule the ESLint 10 migration.
- Google SDK instructions were read from googleapis/js-genai codegen_instructions.md. Installed SDK types verify structured responseJsonSchema, AbortSignal, HTTP timeout/retry fields, and Octokit repositoryNames/permissions. No fabricated browsing claims.
- Browser RLS is select-only. Server-only transactional RPCs own mutation transitions, preventing direct browser status forgery. Original capture/evidence is stored atomically and separately from editable reports.
- Require a UUID idempotency key plus confirmed:true; additional /reconcile endpoint is explicit and documented. Supabase+GitHub cannot offer a single distributed transaction; preserving unknown state avoids blind duplicate creation.
- Use current GitHub user installation access and App installation credentials together. An App installation ID alone does not prove user access. OAuth state is one-use and bound to the signed-in account.
- Persist pairing/session hashes, not raw secrets. One-time token delivery means a lost exchange response requires a new pairing.
- Do not apply migrations to a user's hosted database during implementation validation. Run the exact migration against disposable PostgreSQL with explicit Supabase auth stubs. Missing auth/project/App credentials block live checks but not deterministic development checks.
- Production frontend and capture extension remain Kartik's scope. A minimal dashboard exercises auth, integration, review, drafts, duplicates, publication, reconciliation and pairing approval/revocation.
- AI output never supplies executable tools. Model evidence is constrained to input quotations and replaced with original evidence. Unverified reproduction/cause/fix fields are cleared. Human report edits are the source of final issue content.
