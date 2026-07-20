# Supabase Setup

How to provision and configure the Supabase PostgreSQL project(s)
ProcessPilot's Phase 4 schema depends on. See
[environment-variables.md](environment-variables.md) for where the
resulting credentials go and
[docs/architecture/database-schema.md](../architecture/database-schema.md)
for what gets deployed into the project.

This is dashboard configuration only — it cannot be scripted from inside
this repository, and no project is provisioned yet as of Phase 4 landing.

## 1. Create the project(s)

Per [environment-variables.md — where secrets live](environment-variables.md#where-secrets-live)
and this project's remote-first rules, Preview and Production must use
**separate managed environments**. Production is out of scope for Phase 4
(see the [phase tracker](../project/phase-tracker.md)'s entry criteria for
later deployment phases) — provision at minimum:

- A **development** Supabase project (used from Codespaces).
- A **preview** Supabase project (used by Vercel Preview deployments and
  `preview-checks.yml`).

In the [Supabase dashboard](https://supabase.com/dashboard): **New
project** for each, in the same organization. Choose a region close to
where Vercel/GitHub Actions run (US East is a reasonable default unless
told otherwise).

## 2. Collect credentials

From each project's **Settings > API** and **Settings > Database**:

| Value                                     | Where it's shown                              | Maps to                                |
| ----------------------------------------- | --------------------------------------------- | -------------------------------------- |
| Project URL                               | Settings > API > Project URL                  | `NEXT_PUBLIC_SUPABASE_URL`             |
| `publishable` key                         | Settings > API > Project API keys             | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| `secret` key                              | Settings > API > Project API keys (reveal)    | `SUPABASE_SECRET_KEY`                  |
| Direct connection string (session pooler) | Settings > Database > Connection string > URI | `SUPABASE_DB_URL`                      |
| Project ref                               | Settings > General > Reference ID             | Used by `supabase link`                |

`SUPABASE_DB_URL` is the one Phase 4 code actually connects with (see
[clerk-supabase-identity-sync.md](../architecture/clerk-supabase-identity-sync.md)
for why the secret key isn't used directly for database access). Prefer
the **session pooler** connection string, not the direct (non-pooled)
one — this repo's server code opens short-lived transactions per request,
which pooled connections handle well; the direct connection has a low
connection-count ceiling unsuited to that pattern.

## 3. Set the environment variables

Set all four (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SECRET_KEY`, `SUPABASE_DB_URL`) in:

- **Codespaces secrets** (repo/org Settings > Secrets and variables >
  Codespaces) — development project's values.
- **GitHub Actions secrets** (repo Settings > Secrets and variables >
  Actions) — used by `preview-checks.yml` and any future integration-test
  CI job; preview project's values.
- **Vercel Preview environment variables** — preview project's values.

Never commit real values anywhere — see
[environment-variables.md](environment-variables.md) and
[SECURITY.md](../../SECURITY.md).

## 4. Link the CLI and apply migrations

From a Codespace (or any environment with the four variables set):

```bash
npx supabase login          # once per machine — opens a browser auth flow
npm run db:link             # supabase link — prompts for the project ref
npm run db:migrate          # supabase db push — applies supabase/migrations/*.sql
npm run db:types            # regenerates src/lib/db/database.types.ts from the live schema
```

`supabase link`/`db push`/`gen types` all operate on the **remote linked
project** — none of this starts a local Docker-based Supabase stack
(`supabase start`), which this project's remote-first rules
([CLAUDE.md](../../CLAUDE.md)) rule out. See
[database-migrations.md](database-migrations.md) for the full migration
workflow.

## 5. Seed development data (optional)

```bash
npm run db:seed -- --yes-seed-dev
```

Seeds the fictional "Northstar Property Group" organization (see
[milestone-2-core-platform.md](../project/milestone-2-core-platform.md)).
Refuses to run against anything that looks like a production database —
see `scripts/seed-dev-data.mjs`'s `assertSafeToSeed()`. Pass `--reset` to
delete and re-seed a clean copy.

## 6. Verify

```bash
npm run test:integration
```

Runs `src/lib/db/tenant-isolation.integration.test.ts` against the linked
project, proving the RLS policies actually enforce cross-tenant isolation.
Without the environment variables set, this suite reports every test
skipped rather than failing — that's expected until this setup is done.

## Related documents

- [Environment variables](environment-variables.md)
- [Database migrations](database-migrations.md)
- [docs/architecture/database-schema.md](../architecture/database-schema.md)
- [docs/architecture/clerk-supabase-identity-sync.md](../architecture/clerk-supabase-identity-sync.md)
