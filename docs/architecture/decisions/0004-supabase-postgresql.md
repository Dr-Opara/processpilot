# ADR-0004: Supabase PostgreSQL and private storage

## Status

Accepted — implemented in Phase 4 (Database and tenant isolation). See
[docs/architecture/database-schema.md](../database-schema.md) for the
schema and [docs/development/supabase-setup.md](../../development/supabase-setup.md)
for project provisioning, which remains a manual step per environment.

## Context

ProcessPilot needs a managed relational database supporting strong
tenant-isolation guarantees (see [multi-tenancy.md](../multi-tenancy.md))
plus private object storage for evidence and knowledge-document uploads
(see [file-storage.md](../file-storage.md)), without operating either
service on infrastructure the team manages directly (ruled out by
[CLAUDE.md — remote-first development rules](../../../CLAUDE.md): no
local database, no local Docker).

## Decision

Use Supabase-managed PostgreSQL as the primary database, and Supabase
private storage for file uploads.

## Alternatives considered

- **Neon Postgres + a separate storage provider (e.g. S3-compatible).**
  Considered — Neon is a strong managed-Postgres alternative. Supabase
  was chosen to colocate database and storage under one provider
  relationship and because its RLS-first tooling and client libraries
  directly support the [PostgreSQL Row-Level Security](0005-postgresql-row-level-security.md)
  decision.
- **PlanetScale (MySQL-compatible).** Rejected: PostgreSQL's native Row-
  Level Security is a direct fit for the multi-tenancy model; MySQL does
  not offer an equivalent built-in mechanism.
- **Self-managed Postgres (e.g. on a VM).** Rejected outright by the
  remote-first, no-local/self-managed-infrastructure rule in
  [CLAUDE.md](../../../CLAUDE.md).

## Consequences

- Database and storage are managed by one provider, simplifying
  operational surface area during early phases.
- Ties core data infrastructure to Supabase; mitigated at the
  storage-adapter boundary being narrow enough to swap if needed, though
  the RLS-based data model itself (PostgreSQL-specific) is not
  provider-neutral by design — see
  [ADR-0005](0005-postgresql-row-level-security.md).

## Security implications

Service-role credentials capable of bypassing RLS are server-only and
never sent to the browser, per
[multi-tenancy.md — principle 5](../multi-tenancy.md). Storage access is
private-by-default per [file-storage.md](../file-storage.md).

## Revisit conditions

Revisit if Supabase's managed-Postgres offering cannot meet performance
or compliance requirements discovered during Phase 4 implementation or
later scale testing.
