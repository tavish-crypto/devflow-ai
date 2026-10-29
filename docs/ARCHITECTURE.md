# Architecture

A pnpm strict-TypeScript workspace contains a Next.js App Router backend and minimal dashboard, a WXT React extension scaffold, and shared runtime Zod contracts. Supabase Auth establishes dashboard identity; Next SSR refreshes and writes session cookies. Request handlers validate shape, size, origin, consent, identity and ownership before processing.

PostgreSQL is the durable source of truth. Browser users can only select their own profiles, issues, evidence and events under RLS. Integration credentials, pairing hashes and token hashes have no browser grants or policies. Writes use narrowly scoped definer functions executable only by service_role; the server obtains the user from a validated session before supplying p_user. Every use of the service role must retain explicit user_id filters. Original capture evidence is retained separately from the editable report.

Analysis sends a bounded redacted capture to Gemini without tools. The page is untrusted data; validated structured output is labeled AI and may be rejected. Deterministic fallback preserves observed/user evidence without inventing behavior. Report evidence is replaced with the exact input and reproduction/cause/fix fields are cleared because the provider cannot verify them.

GitHub connection requires user OAuth authorization plus verified App installation access. Tokens at rest use authenticated encryption. Repository listing is the intersection granted to the user's installation token; target operations recheck this permission and mint a repository-scoped installation token. Duplicate scores are lexical heuristics.

Publication locks the issue row, reserves its UUID idempotency key and status in one transaction, then performs one external POST. Completion persists GitHub number/URL with an audit event. PostgreSQL cannot atomically commit with GitHub; timeouts/crashes use publish_unknown and explicit marker-based reconciliation rather than potentially duplicate POSTs. A stale publishing lease transitions to unknown after 30 seconds. Unknown never automatically becomes retryable.

Pairing uses a 32-byte polling secret separately from a short display code. Only hashes of polling/session secrets are stored. A dashboard user explicitly approves the display code; a locked, one-use exchange creates an hour-long scoped session. Revocation and expiration are checked per request. Database rate limits work across server workers.

Live provider credentials and deployed configuration are separate from local tests. No hosted database changes, live GitHub issue creation, deployment or production certification are implied by a passing build.
