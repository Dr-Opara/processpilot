# ADR-0005: PostgreSQL Row-Level Security

## Status

Accepted — implemented in Phase 4 (Database and tenant isolation). Every
table in [supabase/migrations/](../../../supabase/migrations/) has RLS
enabled and at least one policy, enforced by
`src/lib/db/schema-coverage.test.ts` on every change. See
[docs/architecture/database-schema.md](../database-schema.md#rlssession-context-model)
for the session-context mechanism policies read.

## Context

Application-layer permission checks alone are a single point of failure
for tenant isolation — one missed `organization_id` filter in one query
path can leak cross-tenant data. ProcessPilot's
[multi-tenancy principles](../multi-tenancy.md) require defense in depth.

## Decision

Enforce tenant isolation at the database layer using PostgreSQL Row-Level
Security policies on every tenant-owned table, scoping rows to the
caller's authenticated organization, in addition to (not instead of)
application-layer checks.

## Alternatives considered

- **Application-layer checks only (no RLS).** Rejected: a single missing
  `WHERE organization_id = ...` clause in application code becomes a
  cross-tenant data leak with no independent backstop — unacceptable for
  a product whose customers include regulated, compliance-sensitive
  organizations.
- **Separate database/schema per tenant.** Rejected: operationally heavy
  at the scale and stage ProcessPilot is targeting (many organizations,
  not a handful of large ones needing physical separation); migrations
  and cross-tenant analytics become significantly harder to manage.
- **Separate database per tenant tier only (e.g. enterprise gets
  isolation, others share).** Rejected for now as premature complexity;
  RLS provides strong isolation without per-tenant infrastructure
  overhead. Revisit if a specific enterprise contract requires physical
  isolation.

## Consequences

- Every new tenant-owned table requires an RLS policy as part of its
  migration — a merge-blocking requirement, not optional follow-up.
- Cross-tenant access tests (see
  [multi-tenancy.md — principle 6](../multi-tenancy.md)) become
  meaningfully testable against a real enforcement layer, not just
  application code review.
- Query authoring must account for RLS context (setting the correct
  session/role context per request) — a discipline the data-access layer
  must enforce consistently, designed in Phase 4.

## Security implications

This is itself a security control: it ensures a bug in application-layer
authorization does not automatically become a cross-tenant data breach.
Service-role credentials that bypass RLS remain server-only and are used
narrowly, with their own application-layer scoping, per
[multi-tenancy.md](../multi-tenancy.md).

## Revisit conditions

Revisit if RLS policy evaluation becomes a measured performance
bottleneck at production scale, or if a specific enterprise customer
contractually requires physical per-tenant database isolation.
