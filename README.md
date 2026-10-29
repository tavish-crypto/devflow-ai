# DevFlow AI

Backend foundation for evidence-backed, user-reviewed GitHub issues. Tavish owns the backend; Kartik owns the extension capture flow and polished UI.

## Develop

Use Node **24 LTS** and pnpm **11.25.0**. From the repository root:

```sh
corepack enable
corepack pnpm install --frozen-lockfile
cp .env.example apps/web/.env.local
# Supply your own credentials; never commit .env.local.
pnpm dev
```

The web app starts on port 3000. Without configuration, the dashboard renders and `/api/v1/health` reports integration configuration flags; private endpoints fail closed. Gemini has a deterministic editable fallback. Authentication and persistence require Supabase. The extension is a WXT React scaffold; it does not yet capture or pair.

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:db
pnpm build
pnpm --filter @devflow/web start
```

`test:db` starts and removes a disposable local PostgreSQL cluster. It **never** reads `DATABASE_URL` or changes your Supabase database. It stubs only the Supabase `auth.users`/`auth.uid()` boundary, then applies the actual SQL migration. Linux x64 is validated; see the embedded-postgres support matrix for other platforms. Run it as a non-root user.

## Workflow

1. Configure Supabase, sign in using a magic link, and install/authorize the GitHub App on selected repositories.
2. Review and redact the capture; explicitly consent to analysis.
3. Review every AI field, edit the ProofPack JSON, choose an authorized repository, save a draft.
4. Check heuristic duplicate candidates; explicitly confirm publication.
5. If a timeout leaves the remote outcome unknown, reconcile it. Never blindly retry.

See [ENV_SETUP](docs/ENV_SETUP.md), [API contract](docs/API_CONTRACT.md), [architecture](docs/ARCHITECTURE.md), [security](docs/SECURITY.md), [test results](docs/TEST_RESULTS.md), [decisions](docs/ENGINEERING_DECISIONS.md), and [Kartik handoff](docs/HANDOFF.md).

This is a tested foundation, **not a production security certification**. Live provider validation and credential setup remain outstanding; exact results are recorded in TEST_RESULTS.
