# Kartik handoff

Build on feat/tavish-core and import schemas/types from @devflow/contracts. Do not rename frozen capture/report/issue fields or status values. The WXT React popup is scaffold only: build capture review, explicit consent, pairing start/poll, short-lived token storage and revocation UX. Use activeTab only when the user initiates capture; do not broaden permissions silently. No GitHub or provider secrets belong in extension code/storage.

Use API_CONTRACT.md for exact JSON and auth rules. Keep pairingId and pollingSecret private, display only the short code for dashboard confirmation, poll every 3 seconds or slower, retain the returned scoped token only until expiry/revocation. A lost one-time response requires a new pairing. Extension scopes permit analysis/draft access only; publishing stays in the authenticated dashboard.

Replace the functional dashboard with polished login, review/redaction, editable ProofPack, repository selection, heuristic duplicates and persistent issue UI. Always display AI versus fallback mode and generated/unverified fields. Keep confirmed:true publication behind a clear user decision and preserve an issue's idempotency key across clicks/reloads. Unknown results require reconciliation, never a new publish key. Show safe errors without capture/provider secrets. Multiple GitHub App installations need a proper chooser.

Provision real Supabase Auth/API credentials, run the reviewed migration, configure GitHub App and rotate exposed credentials before live testing. Do not interpret local tests as real provider validation. Extend tests for any new auth, scope or state transition; preserve RLS and server ownership filters.
