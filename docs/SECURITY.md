# Security and limitations

## Enforced boundaries

- Supabase getUser validation; no client user IDs; owner-filtered server queries and PostgreSQL RLS.
- Service-only mutation RPCs, transactional status changes and composite evidence ownership foreign keys.
- Exact Origin checks for cookie writes, restrictive extension CORS, HttpOnly OAuth state, fixed callback destinations, validated user installation membership.
- Server-only provider keys, encrypted GitHub user tokens, repository-scoped short-lived installation tokens; no provider secrets in extension bundles.
- Explicit analysis consent, explicit pairing approval and explicit publication confirmation.
- Bounded JSON streams, strict shared schemas, database throttling, token hashing, one-use pairing exchanges, expiry and revocation.
- No capture URL fetching, shell tools, remote code execution, model tools, HTML rendering or raw provider error logging.
- AI output is untrusted and runtime-validated; evidence must be exact quotes. Evidence is always replaced with original capture provenance. Suggested causes/fixes and reproduction steps remain empty until a user edits them.
- Escaped GitHub body HTML and mass mentions; React escaped rendering. Browser security headers, no-store private responses.

## Threat model and remaining work

Webpage text may contain prompt injection or secrets. Detection is heuristic and may miss obfuscated patterns. Users must review/redact before consent and review every AI-generated field. Model summaries can be inaccurate. The service has no tools with which model text could execute commands.

The server secret bypasses RLS by design. Never send it to the browser; every new server query must preserve authentication and ownership filtering. PostgREST browser roles cannot execute the mutation functions. Validate deployed policies and role grants in the real Supabase project before launch. The local PostgreSQL harness substitutes auth.users/auth.uid and does not test Supabase itself.

Global public rate buckets avoid trusting forged forwarding headers, but can be exhausted by an attacker. Add trusted-edge per-IP throttling, monitoring and quotas before production. Database rate-limit rows older than a day are pruned. Pairing/session retention cleanup should be scheduled after an explicit privacy policy is chosen. Page selections and notes are private data persisted in the database; define retention/deletion and consent policies before launch.

Minimal Next UI currently permits inline scripts/styles through CSP for Next hydration; tighten with nonces in the production frontend. GitHub issue bodies may still contain ordinary user-authored Markdown links; users review these before publishing. No live provider workflow, penetration test or production security review has been completed.

GitHub user access expiry/revocation fails closed; reconnect is required, and automatic refresh/webhook cleanup are not implemented. Unknown publishing outcomes may need manual resolution if the marker is removed or older than the reconciliation scan horizon. No automatic retry is allowed in that situation.

Treat credentials shared in chat as exposed. Rotate the supplied Supabase database password and Gemini credential; store replacements only in approved environment secret settings. Use TLS verification and URL-encoded connection passwords. Never commit secrets or disable package checksum/TLS verification.

Report vulnerabilities privately to the repository owner; do not publish private captures or secrets in public issues.

## Product client boundaries

The extension requests only activeTab, scripting, sidePanel, storage, and the exact configured backend host. No blanket site hosts, passive content scripts, console collection, screenshot sharing, or browser-history access are implemented. Its capture message handler accepts only the extension's own side-panel URL, rejecting content-script senders. Selections remain untrusted data and are rendered as escaped text.

Pairing/session secrets stay in trusted `chrome.storage.session`; recovery drafts stay in device-local storage, never sync storage. Local recovery is not encrypted against someone with access to the same unlocked browser profile. Dashboard recovery keys include account identity. Clear/disconnect controls require confirmation, and dashboard settings can actually revoke server sessions before a device token is removed.

Account metadata and GitHub disconnect are server-only authenticated operations, with explicit current-user filters and no credential material in their response. Browser artifacts are checked separately with `scripts/check-browser-bundles.mjs`; pattern scans are defense in depth, not a proof that arbitrary secrets can never be included.

The UI requires saved repository/report state, an actual duplicate lookup, distinctness acknowledgement, and confirmation before a publish request. There is no automatic publication on navigation or analysis. The issue UUID is the stable idempotency key. Transport failures block another publish until reloading authoritative state, and `publish_unknown` remains reconciliation-only.
