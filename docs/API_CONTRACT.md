# Shared API contract v1

Canonical Zod schemas and TypeScript types live in `packages/contracts/src/index.ts`. CaptureInput, IssueReport, Issue and status names match the supplied frozen contract. The publish payload additionally requires `confirmed: true`, as required for explicit confirmation. Request objects reject unknown fields, including forged user IDs. Authenticated identity always comes from Supabase `getUser()` or a validated scoped extension session.

## Transport and auth

JSON endpoints live under `/api/v1`; JSON bodies are limited to **64,000 bytes** while streaming. Validation failure: 400; missing/invalid auth: 401; CSRF/origin or repository denial: 403; invisible/missing issue: 404; state conflict: 409; expired pairing: 410; oversized body: 413; wrong content type: 415; redaction required: 422; throttled: 429; external failure: 502; missing configuration/database/rate-limit service: 503. Errors are `{code,message,requestId?}` with no upstream response bodies. Successful JSON requests return 200. Responses are uncached.

Dashboard requests use Supabase SSR cookies. Mutating cookie requests require an exact Origin matching `NEXT_PUBLIC_APP_URL`. Exact configured extension origins may use bearer-authenticated routes; CORS has no wildcard and does not enable cross-origin cookies. Extension auth: `Authorization: Bearer df_<43-character-secret>`. Scope is limited to analysis and draft issue read/write; GitHub operations, publication, pairing confirmation and revocation require a dashboard session.

Limits are atomic database buckets: 60 requests/user/minute, 10 analysis requests/user/minute, 5 pairing approvals/user/minute, 30 polls/pairing/minute, 60 starts and 300 polls globally/minute, 20 login requests globally/minute. Global unauthenticated limits favor fail-closed abuse protection. A production deployment also needs ingress/IP throttling. No raw request bodies or provider responses are logged.

## Payloads

```ts
CaptureInput = {pageTitle:string, url:string, selectedText:string,
  userNotes?:string, capturedAt:ISOstring}
IssueReport = {title:string,summary:string,issueType:'bug'|'task'|'docs',
  priority:'low'|'medium'|'high',actualBehavior:string|null,
  expectedBehavior:string|null,reproductionSteps:string[],
  possibleCause:string|null,suggestedFix:string|null,
  missingInformation:string[],
  evidence:{kind:string,content:string,source:'observed'|'user'}[],
  aiFields:string[]}
Issue = {id:UUID,status:'draft'|'publishing'|'published'|'publish_unknown'|'failed',
  report:IssueReport,repoOwner?:string,repoName?:string,
  githubIssueNumber?:number,githubUrl?:string,createdAt:ISOstring,updatedAt:ISOstring}
```

Captures accept only absolute HTTP(S) URLs (metadata only; never fetched). Title: 500 chars, URL: 2,048, selected text: 16,000, notes: 4,000. Report field/array bounds are exported in Zod.

| Method / path                | Request                                 | Response / authorization                                                                                                 |
| ---------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| GET `/health`                | none                                    | `{status:'ok',version:1,integrations:{supabase,gemini,github}}`; public; booleans mean configured, not live verified     |
| POST `/analyze`              | `{capture,consent:true}`                | `{report,mode:'ai'                                                                                                       | 'fallback'}`; dashboard or extension |
| GET `/issues`                | none                                    | `{issues:Issue[]}` newest 100, current user only; dashboard or extension                                                 |
| POST `/issues`               | `{report,capture,repoOwner?,repoName?}` | `{issue}`; atomic draft and immutable original evidence; dashboard or extension                                          |
| GET `/issues/:id`            | none                                    | `{issue}` current owner only; dashboard or extension                                                                     |
| PATCH `/issues/:id`          | `{report?,repoOwner?,repoName?}`        | `{issue}`; only draft/failed; repository fields supplied together; dashboard or extension                                |
| POST `/issues/:id/publish`   | `{idempotencyKey:UUID,confirmed:true}`  | `{issue,remoteResult:'created'                                                                                           | 'existing'                           | 'unknown' | 'failed'}`; dashboard only |
| POST `/issues/:id/reconcile` | `{confirmed:true}`                      | `{issue,remoteResult:'existing'                                                                                          | 'unknown'}`; dashboard only          |
| GET `/github/repositories`   | none                                    | `{repositories:[{owner,name,fullName,private}]}`; dashboard only                                                         |
| GET `/github/duplicates`     | query `owner`, `repo`, `title`          | `{candidates:[{number,title,url,state,score}]}`; dashboard only; score is a lexical Jaccard heuristic, not AI confidence |
| POST `/pairing/start`        | `{}`                                    | `{pairingId,code,pollingSecret,expiresAt}`; public, approved origin required                                             |
| POST `/pairing/confirm`      | `{code,confirmed:true}`                 | `{pairingId,status:'approved'}`; dashboard only                                                                          |
| POST `/pairing/status`       | `{pairingId,pollingSecret}`             | `{status:'pending'}` or `{status:'approved',sessionId,expiresAt,token,scopes}`; public; token is returned **once**       |
| POST `/pairing/revoke`       | `{sessionId:UUID}`                      | `{revoked:true}`; dashboard owner only                                                                                   |

Keep `idempotencyKey` stable for an issue across clicks/reloads. A different key conflicts after the first claim. Concurrent clicks receive 409. A published issue returns existing without a second remote call. A timed-out POST becomes `publish_unknown`; a stale `publishing` claim becomes unknown after 30 seconds. Reconciliation scans up to 2,000 recent repository issues for the private UUID marker in the body. A missing marker does not prove absence: retain unknown, inspect manually, and never auto-retry.

Remote permission/rate-limit failures preserve the draft as failed (`remoteResult:'failed'`). GET integration errors return typed errors. A failure after remote creation, including DB acknowledgement failure, is treated as unknown. If the DB is unavailable even to record unknown, the stale claim is recoverable through reconciliation.

## Authentication and GitHub App routes

- POST `/auth/login`: URL-encoded form `{email}`. Sends a real Supabase PKCE magic link. Same-origin only, rate-limited.
- GET `/auth/callback?code=…`: exchanges Supabase PKCE code for SSR session cookies. Invalid/expired links return 401. Redirect destination is fixed to the configured app origin.
- GET `/api/github/install`: authenticated redirect to the configured App installation page. Choose selected repositories.
- GET `/api/github/authorize`: authenticated GitHub App user OAuth redirect, random state in HttpOnly SameSite cookie.
- GET `/api/github/callback?code=…&state=…&installation_id=…`: consumes state, verifies logged-in user, exchanges code, verifies GitHub user installation access, encrypts the user token. If exactly one installation for the App is available, installation_id may be omitted. Multiple installations require an explicit valid installation_id; the minimal UI does not provide an installation chooser.

On GitHub, set the OAuth callback to `/api/github/callback`. The installation setup URL can point to the dashboard; user OAuth authorization follows installation. No extension ever receives a GitHub or Supabase admin credential.

Session cookies are refreshed by Next proxy and by route SSR clients. Do not authenticate using `getSession()` data alone. Pairing codes expire after 5 minutes; exchanged scoped sessions expire after 1 hour and can be revoked. Poll every 3 seconds or slower. Losing the one-time token requires a new pairing.

## Product account-management endpoints

- GET `/api/v1/account`: dashboard session only, normal user rate limit. Returns `{email:string|null,githubConnected:boolean,sessions:{id:UUID,expiresAt:ISOstring,revokedAt:ISOstring|null}[]}`. Session metadata is owner-filtered and bounded to the newest 50. No credential hashes, encrypted integration data, or bearer tokens are exposed.
- POST `/api/v1/github/disconnect`: dashboard session and same-origin only; strict `{confirmed:true}` body. Removes only the current user’s stored GitHub connection and returns `{disconnected:true}`. Reports and the GitHub App installation remain; reconnect requires user authorization again.
- POST `/auth/logout`: same-origin Supabase sign-out and 303 redirect to `/login`.
- Successful `/auth/callback` now redirects to `/dashboard`.

The product client uses the issue UUID itself as the stable publication `idempotencyKey`, across reloads and clients. Extension tokens remain unable to access the new account/disconnect endpoints or GitHub/publish/reconcile routes. The extension opens the saved dashboard issue for those operations.

All pairing and account-session response timestamps are normalized from database timezone offsets to canonical UTC `Z` strings, matching the shared response schemas. The new account/disconnect schemas are exported from `packages/contracts`.
