# Database Migrations

How schema changes are made, reviewed, and applied. See
[supabase-setup.md](supabase-setup.md) for provisioning the project this
operates against and
[docs/architecture/database-schema.md](../architecture/database-schema.md)
for what's currently deployed.

## Where migrations live

`supabase/migrations/*.sql` — plain, committed SQL files, timestamp-
prefixed (`YYYYMMDDHHMMSS_description.sql`), applied in filename order.
Not an ORM's auto-generated migration format — hand-authored SQL, reviewed
like any other code change.

## Writing a new migration

1. `npx supabase migration new <description>` (or create the file by hand
   following the existing naming pattern) under `supabase/migrations/`.
2. Every new tenant-owned table, in the _same_ migration:
   - `organization_id uuid not null references organizations(id) on
delete cascade` (or documented why not, e.g. `roles`' nullable
     column for system vs. custom roles).
   - `enable row level security` and at least one `create policy`.
   - An index or unique constraint whose leading column is
     `organization_id` — a plain `create index` if no unique constraint
     already covers it (check first: a composite `unique (organization_id,
...)` already provides one via its leading column, and a second plain
     index on the same leading column is redundant).
   - `created_at`, `updated_at` (+ the shared `set_updated_at()` trigger),
     `created_by`, and `archived_at` or an explicit `status`.
3. Run `npm test` — `src/lib/db/schema-coverage.test.ts` statically
   parses every migration file and fails if RLS, a policy, or an
   `organization_id` index is missing on any table that has an
   `organization_id` column. This requires no database connection and
   catches the most common mistake before you even apply anything.
4. Add or extend cross-tenant isolation coverage in
   `src/lib/db/tenant-isolation.integration.test.ts` per
   [multi-tenancy.md principle 6](../architecture/multi-tenancy.md) — this
   one _does_ need a live database (see below).
5. Update [database-schema.md](../architecture/database-schema.md)'s table
   list and ERD in the same change.

## Applying migrations

```bash
npm run db:migrate   # supabase db push — applies pending migrations to the linked remote project
npm run db:types      # regenerates src/lib/db/database.types.ts from the live schema
```

Both require the project to be linked (`npm run db:link`, see
[supabase-setup.md](supabase-setup.md)) and `SUPABASE_DB_URL` set. Neither
starts a local database — they operate on the linked remote Supabase
project, consistent with this project's remote-first rules
([CLAUDE.md](../../CLAUDE.md)).

`database.types.ts` is committed. Until a Supabase project exists to
generate it from, it's hand-maintained (see that file's own header
comment) to match the migrations — regenerate and replace it the first
time `db:types` actually runs against a real project, and every time
after a schema change.

## Rollback

There is no automated `down` migration tooling — Supabase's CLI migration
model is forward-only, matching how most teams actually operate in
practice (a broken migration is fixed forward with a new migration, not
rolled back in place once other work may have layered on top of it).
For Phase 4 (pre-launch, no real customer data), a mistaken migration
applied to the dev/preview project can be corrected by editing the
project's schema directly via the Supabase SQL editor and then committing
a corrective migration that leaves the file history accurate — never by
silently rewriting an already-applied migration file.

## Never do this

- Never apply a migration directly via the Supabase dashboard SQL editor
  as the _only_ record of a schema change — it must also exist as a
  committed file, or the next `db push` will be out of sync with reality.
- Never edit an already-applied migration file in place — write a new
  migration instead, even to fix a mistake in a recent one, once it has
  been applied anywhere (including a shared dev project).
- Never run `supabase db push` against a production project without the
  explicit review this project's [git workflow](git-workflow.md) and
  [phase tracker](../project/phase-tracker.md) require for that phase.

## Related documents

- [Supabase setup](supabase-setup.md)
- [docs/architecture/database-schema.md](../architecture/database-schema.md)
- [docs/architecture/multi-tenancy.md](../architecture/multi-tenancy.md)
