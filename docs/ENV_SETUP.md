# Environment setup

Use Node 24 LTS and pnpm 11.25.0. Install with `pnpm install --frozen-lockfile`. Copy the root `.env.example` to `apps/web/.env.local`, which is ignored. In deployment, supply equivalent server runtime environment variables. Never add credentials to source, CI YAML, screenshots, or logs. Rotate any keys/passwords pasted into chat.

## Supabase

1. Create/select the Supabase project. In its API settings obtain the project URL and publishable key. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
2. Obtain the backend secret key; set server-only `SUPABASE_SECRET_KEY`. It must never have a `NEXT_PUBLIC_` prefix. The client only uses SSR cookies; sensitive writes execute service-only PostgreSQL RPCs after server authentication.
3. In Auth enable email magic links, set the site URL to `NEXT_PUBLIC_APP_URL`, and allow the exact `/auth/callback` redirect for development and deployment. Configure production SMTP and redirect policies before release.
4. Review `supabase/migrations/202610290001_core.sql`. Apply it once using Supabase's SQL editor or a PostgreSQL client against the **intended** project. The migration is transactional and intentionally not silently rerunnable. Standard Supabase roles and `auth.users` must exist.
5. Sign in as two test users and verify private draft isolation against the actual Supabase instance. Local RLS tests do not validate the hosted Auth service or project settings.

A PostgreSQL pooler URL does **not** supply the Auth URL, publishable key or backend API secret. Session-pooler port 5432 or the direct database endpoint is preferable for migration tooling; transaction-pooler port 6543 is not the application's auth/API configuration. URL-encode special password characters (for example `@` → `%40`). Use certificate verification (`sslmode=verify-full`) and the provider's CA where required. Never disable TLS verification.

`pnpm test:db` uses a disposable local database and never reads your production DATABASE_URL. No hosted migration was applied during this implementation.

## Google Gemini

1. Create a Gemini Developer API key through Google AI Studio; restrict it to the Generative Language API and set budget/quota controls.
2. Set server-only `GEMINI_API_KEY`. Set `GEMINI_MODEL` to a stable model available in your project; the default is `gemini-2.5-flash`. Availability is not asserted without a live request.
3. Allow HTTPS to `generativelanguage.googleapis.com` in restricted cloud environments. Node's server commands enable the standard environment proxy; do not unset proxy variables or disable TLS.
4. Submit only a redacted, explicitly consented capture from the signed-in dashboard. Check the returned `mode`; missing key, validation failure, quota error, timeout or suspicious input yields `fallback`. No provider request is made without consent.

The implementation uses the official `@google/genai` 2.32.0 SDK and JSON-schema output validated by Zod. There is a single attempt, SDK timeout 8 seconds, outer timeout 9 seconds, no tools and no automatic function calls. Heuristic secret/injection detection is defense in depth, not a proof that arbitrary page text is safe. Generated claims remain editable and unverified.

## GitHub App

Create a GitHub App owned by the intended account/organization:

- Repository permissions: **Metadata read** and **Issues read/write** only. Install on **selected repositories**.
- User authorization callback: `https://YOUR_APP/api/github/callback`.
- Setup URL: dashboard origin. Install, then authorize the user account from the dashboard.
- Set `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`.
- Generate a private key and base64-encode its PEM locally; set `GITHUB_PRIVATE_KEY_BASE64`. Do not paste it in chat.
- Generate `APP_ENCRYPTION_KEY` with `openssl rand -hex 32`. Store the resulting 64 hex characters as a server secret used **locally** for AES-256-GCM. A proxy placeholder cannot serve as this local cryptographic key. Back it up securely; changing it makes existing encrypted connections unreadable and requires reconnection.
- Allow HTTPS to `api.github.com` and `github.com`. Server-generated installation tokens remain server-side and are narrowed to the target repository. The user's current installation access is rechecked before each repository operation.
- User OAuth token expiry/revocation fails closed and requires reconnection. Automatic OAuth refresh and multi-installation selection UI are future work.

No live issue creation was attempted because App credentials were not configured. The current user authorized one smoke-test issue in tavish-crypto/devflow-ai if needed; use the actual product workflow once setup is complete. Future sessions require their own authorization context.

## Extension and deployment

Set `ALLOWED_EXTENSION_ORIGINS` to exact origins such as `chrome-extension://YOUR_EXTENSION_ID`, comma-separated, no wildcard. Empty means no extension origins allowed. Pairing confirmation and publishing require dashboard auth; scoped extension tokens cannot perform them.

`NEXT_PUBLIC_APP_URL` defaults in the example to `http://localhost:3000`; set the exact HTTPS origin in deployment. Set environment variables before production build when applicable, rebuild and restart. Run all checks before deployment. The product dashboard requires validated sign-in; the public landing page and safe demo are available without service configuration. See PRODUCT_GUIDE for pairing and capture.

The local PostgreSQL tests use `embedded-postgres` 18.4.0-beta.17 with checksum-verified registry artifacts. Its platform binary lifecycle script creates packaged symlinks. Linux x64 is validated. If CI runs as root, switch to a non-root runner rather than weakening PostgreSQL safeguards.

Required credentials were not populated from the chat. Securely provision rotated values and remaining settings in your environment/deployment secret manager. This work does not publish an environment or deploy the app.
