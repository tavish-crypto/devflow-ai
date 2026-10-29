# Product handoff

Kartik’s product branch starts at Tavish’s `86ef79f17cdb669eaebee00c5a5320e3b4fc4098` backend commit. Its ancestry and backend architecture are retained. The frontend uses existing contracts and services, with narrowly scoped account-management additions described in INTEGRATION_AUDIT.

The dashboard has landing, magic-link login, protected overview, issue explorer/detail/editor, manual capture, GitHub integration, settings, pairing approval, and a safe React demo. The extension is a WXT Manifest V3 side panel with real action-click capture, redaction/consent, analysis, provenance editor, local recovery/history, pairing, session handling, saved account history, and dashboard publication handoff.

## External setup still required

- Provision `apps/web/.env.local` privately, following ENV_SETUP. No real provider values were supplied or discovered in this checkout.
- Apply the existing migration to your chosen Supabase project, configure Auth redirect/SMTP settings, and verify two-user isolation against that hosted project.
- Configure and install the GitHub App with metadata read and issues read/write access on the intended repository. Complete user authorization.
- Build the extension for the intended backend origin and allowlist its exact extension origin on that server.
- Perform the live smoke procedure in DEMO. The user authorized one test issue in `tavish-crypto/devflow-ai` if needed; credentials are still required. No issue was created via `gh` as a substitute for testing the product.

## Deliberate boundaries

The extension cannot publish with its scoped bearer token. Final repository selection, duplicate search, and publication use the dashboard cookie session. No all-sites host permission, passive content script, console-reading claim, screenshot capture, browser history access, or additional backend provider was added.

The API returns the newest 100 reports; counts and filters are explicitly scoped to that bounded set. Extension session tokens remain in trusted extension session storage and are cleared on browser restart. Local draft storage is device-local; disconnect clears it. Saved account reports remain in Supabase.

Unknown GitHub outcomes remain non-retryable and require reconciliation or manual investigation. GitHub issue open/closed synchronization is not implemented by the inherited backend: the dashboard reports DevFlow publication state, not a fabricated live GitHub state. Multiple installation selection, automatic OAuth refresh, retention/deletion policy, edge abuse limits, and CSP nonces remain future production work.
