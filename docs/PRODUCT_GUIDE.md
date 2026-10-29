# Product guide

## Dashboard routes

| Route                     | Purpose                                                                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `/`                       | Product introduction with explicitly illustrative report preview                                                                   |
| `/login`                  | Supabase magic-link form, bounded request, loading/error/success feedback                                                          |
| `/dashboard`              | Counts from the newest 100 persisted reports, recent activity, authorized repository summary                                       |
| `/dashboard/new`          | Reviewed manual capture, explicit consent, analysis/fallback, editable report, save                                                |
| `/dashboard/issues`       | Search title/summary and combine publication status, priority, and repository filters                                              |
| `/dashboard/issues/[id]`  | ProofPack, provenance, timestamps, repository, draft edit/recovery, duplicate review, publish/reconcile, real returned GitHub link |
| `/dashboard/integrations` | GitHub installation, user authorization, repository permissions, reconnect and confirmed disconnect                                |
| `/dashboard/settings`     | Validated account, extension session expiry/revocation, sign-out, privacy, confirmed local-draft clearing                          |
| `/connect-extension`      | Authenticated pairing-code review and explicit approval                                                                            |
| `/demo`                   | Deliberately broken, harmless React checkout with selectable visible error                                                         |

Private pages validate Supabase `getUser()` on the server and redirect to `/login` when identity cannot be verified. APIs separately validate identity and ownership. The app’s callback is retained and sends successful sign-ins to `/dashboard`.

## Extension workflow

1. Connect the workspace, review the privacy explanation, and start a five-minute pairing. Only the code is displayed; the polling secret stays in trusted session storage.
2. Open dashboard pairing approval, sign in, enter the matching code, and explicitly approve. Return to the extension and check approval. Polling is limited to at most once every three seconds.
3. Select relevant error text and click the pinned toolbar icon. The synchronous action handler invokes `sidePanel.open()` before any awaited work and captures through `scripting.executeScript` while the temporary active-tab grant exists.
4. Review/redact the title, URL, selection, and notes. Changing any input clears analysis consent. The exact reviewed payload is validated by shared contracts and sent only after checking the consent box.
5. The report editor separates observed selection and developer notes from generated fields. Editing a generated field changes its provenance to developer-entered. Missing fields remain visibly unverified. Causes, fixes, and steps are never passed off as browser observations.
6. Save the private draft. “Review & publish in dashboard” opens its exact saved issue ID. Choose/save an authorized repository, inspect possible duplicate links, acknowledge that the report is distinct, then confirm publication.
7. The success screen shows the actual returned GitHub issue number/URL. The dashboard history reads persisted reports. Unknown remote outcomes require explicit reconciliation; a client timeout blocks further publication until server state is reloaded.

The side-panel Capture button reuses an existing active-tab grant. Clicking a side-panel button alone cannot grant that permission; the UI directs users to the toolbar when necessary. No popup conflicts with `action.onClicked`.

## Persistence and privacy

Capture events are persisted immediately in `chrome.storage.local`, so the service worker owns no indispensable in-memory capture state. Editor recovery stays local; ten displaced valid drafts are archived for recovery from History. Invalid empty captures do not evict valid drafts. The backend stores original evidence separately from editable reports.

Pairing secrets and scoped session tokens use `chrome.storage.session`, which survives worker suspension but ends with the browser session. The default trusted-context access level is preserved. There is no sync-storage token, content-script token access, GitHub token, Gemini key, Supabase admin credential, or provider SDK in the extension.

Local captures are private to the device, not encrypted against another person using the same unlocked browser profile. Disconnect clears the token and local draft/history; use dashboard revocation to terminate server access first. Saved account reports remain available after disconnect. Web recovery keys include the validated user ID.

## Permission rationale

| Permission                | Why                                                                    |
| ------------------------- | ---------------------------------------------------------------------- |
| `activeTab`               | Temporary access only to the tab selected by the user’s toolbar action |
| `scripting`               | Inject a small selection/title/URL reader into that tab                |
| `sidePanel`               | Keep report review beside the source webpage                           |
| `storage`                 | Persist capture/recovery and trusted scoped session data               |
| Exact backend host origin | Reach only the configured API and dashboard                            |

No `<all_urls>`, wildcard site hosts, `tabs`, `history`, `cookies`, `debugger`, `webRequest`, `contextMenus`, clipboard permission, or passive content scripts are requested. The browser-provided tab ID and temporary grant are sufficient for targeted capture. Clipboard writes occur only in explicit user actions.

## Accessibility and design

Shared Radix/shadcn-style Button and confirmation-dialog composition, Lucide icons, self-hosted Geist and JetBrains Mono, product color/spacing tokens, visible focus rings, associated input labels, status/alert regions, keyboard dialogs, responsive navigation, skeletons, empty/error states, restrained Motion transitions, and reduced-motion overrides are included. Automated browser checks cover desktop/mobile overflow and a 380px extension editor. Physical assistive-technology testing remains manual.

## Troubleshooting

- **Capture blocked:** use an ordinary HTTP(S) page, select text, click the toolbar again. Restricted browser pages and extension-store pages may refuse injection; manual entry remains available.
- **Pairing denied:** verify the extension’s exact displayed origin is in `ALLOWED_EXTENSION_ORIGINS`, matching the built backend URL. Restart the backend after configuration changes.
- **Pairing expired or exchange lost:** get a new code. The token is returned only once; do not retry an already-exchanged pairing.
- **Session expired/revoked:** pair again. Local recovery remains until disconnect or browser storage clearing.
- **No repositories:** install on selected repositories, authorize the user account, refresh. Reconnect after GitHub token expiry/revocation.
- **Redaction required:** remove credentials from the capture and report. Detection is heuristic; manually review URLs, query strings, and selected text.
- **Publish timed out:** reload the saved issue. Reconcile `publishing`/`publish_unknown` after the server’s 30-second claim interval. Inspect GitHub manually if no marker is found; do not create a replacement issue as a retry.
- **Device storage full:** keep the panel/page open and save to the account; clear obsolete local recovery deliberately.
