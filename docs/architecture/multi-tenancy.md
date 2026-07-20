# Multi-Tenancy

ProcessPilot is multi-tenant from its first schema, not retrofitted later.
`Organization` is the tenant boundary (see [domain model](domain-model.md)).

## Principles

1. **Every tenant-owned record includes organization ownership.** Every
   table below the organization level carries an `organization_id` column
   that is never nullable and never optional at the application layer.
2. **Organization context must be verified server-side.** The active
   organization for a request is derived from the authenticated session
   (Clerk organization membership), not from a client-supplied value.
3. **Browser-supplied organization identifiers are untrusted.** If a
   request includes an organization ID in a URL, body, or header, the
   server must verify it matches the caller's authenticated membership
   before using it — it is never trusted as-is, even to select _which_
   organization's data to return.
4. **PostgreSQL Row-Level Security enforces database isolation.** RLS
   policies scope every tenant-owned table to the caller's organization
   at the database layer, independent of and in addition to
   application-layer checks. Neither layer alone is considered
   sufficient. See [ADR-0005](decisions/0005-postgresql-row-level-security.md).
5. **Service-role credentials remain server-only.** Any credential capable
   of bypassing RLS (a service role key) is never sent to the browser and
   is used only in trusted server contexts for specific, narrow purposes
   (e.g. system-level background jobs), each of which enforces its own
   organization scoping in application code since RLS is bypassed for
   that credential.
6. **Cross-tenant access tests are mandatory.** Any phase that introduces
   a new tenant-scoped table or a new query path must include an
   automated test proving that a member of Organization A cannot read or
   write a record owned by Organization B. This is a merge-blocking
   requirement, not a nice-to-have.
7. **Suspended and removed memberships immediately lose access.** No
   session, cache, or token may allow continued access after a
   membership is suspended or removed. See
   [authentication and authorization](authentication-and-authorization.md).
8. **External users receive resource-specific access only.** An
   `external_user` (see [user roles](../../product/user-roles.md)) is
   never granted organization-wide membership; their access is scoped to
   the specific resource(s) they were invited to act on, enforced the
   same way (server-verified, RLS-backed) as every other access path.

## What RLS does and does not replace

RLS prevents a compromised or buggy application-layer query from leaking
cross-tenant data. It does **not** replace:

- Application-layer permission checks (RLS scopes by organization; it does
  not know about `process_owner` vs. `employee` distinctions or the
  [permissions matrix](../../product/permissions-matrix.md)).
- Input validation.
- Rate limiting or abuse prevention.

Both layers are required; each covers a failure mode the other doesn't.

## Workspace subdivision

`Workspace` (see [terminology](../../product/terminology.md)) is a
sub-organization grouping, not a separate tenant boundary — it does not
get its own RLS policy set distinct from its parent organization. It
exists for UI/configuration separation within one tenant, not data
isolation between tenants.

## Related documents

- [Domain model](domain-model.md)
- [Authentication and authorization](authentication-and-authorization.md)
- [Data ownership](data-ownership.md)
- [Database schema](database-schema.md) — the implemented schema and RLS/session-context model as of Phase 4.
- [Clerk↔Supabase identity sync](clerk-supabase-identity-sync.md)
- [ADR-0005: PostgreSQL Row-Level Security](decisions/0005-postgresql-row-level-security.md)
