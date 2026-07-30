# Internal Support and Platform Administration (Phase 27)

A cross-tenant, platform-level admin surface for ProcessPilot Technologies'
own support/operations staff — deliberately built as a **separate trust
boundary** from every organization's own role/permission system. See
[authentication-and-authorization.md](authentication-and-authorization.md)
for the tenant-scoped model this phase sits alongside, not on top of.

## Core security property: platform-admin status is not a tenant grant

`src/lib/platform-admin.ts`'s `isPlatformAdminEmail()` reads a
comma-separated allowlist from the `PLATFORM_ADMIN_EMAILS` environment
variable — never a database row. This is the phase's central requirement
("prevent platform-admin capability from being granted through tenant
roles"), enforced structurally rather than by a runtime check: the module
never queries `organization_members`, `roles`, `role_permissions`, or
`member_role_assignments` at all, so no tenant role — however broad,
including `organization_owner` with every permission — can produce a
platform admin. `requirePlatformAdmin()` layers this allowlist check on
top of a normal authenticated Clerk session (`getCurrentProfile()`); it is
an additional narrowing, never a bypass of authentication itself. Changing
who holds platform-admin access is a deployment configuration change, not
an application-level grant.

`src/lib/platform-admin.test.ts` documents this property directly,
including a case asserting that an authenticated, real user with an
organization-owner-shaped profile is still rejected unless their email is
on the allowlist.

## Service layer (`src/lib/services/platform-admin.ts`)

Every function calls `requirePlatformAdmin()` first and runs entirely
through `getAdminSql()` (the admin client, never `withTenantContext()`) —
a platform-admin action is by definition not scoped to one organization's
RLS session, the same reasoning `src/lib/jobs/*` background-job handlers
already use.

- **`listOrganizationsForPlatformAdmin(search?)`** — name/slug search
  across all organizations, with member count, subscription status, and
  suspension status joined in. Capped at 200 rows; no pagination in this
  pass.
- **`getOrganizationDetailForPlatformAdmin(organizationId)`** — one
  organization's full support-relevant picture: member count,
  subscription status, suspension history, support notes, and the most
  recent 20 tenant `audit_events` rows (read-only — platform admins can
  see an organization's own audit trail but this surface never writes to
  it).
- **`lookupUserByEmail(email)`** — case-insensitive profile lookup with
  that profile's memberships across every organization. Returns `null`
  rather than throwing when nothing matches — never fabricates a result.
- **`suspendOrganization({ organizationId, reason })`** /
  **`reactivateOrganization(organizationId)`** — see below.
- **`addSupportNote({ organizationId, note })`** — a freeform,
  append-only note visible only to platform admins, not the organization
  itself.
- **`getPlatformHealthOverview()`** — organization/suspension counts plus
  a re-export of Phase 23's `getQueueHealth()` and
  `getProviderConfigurationStatus()` (see
  [observability.md](observability.md)) rather than a second,
  independently-maintained health check.
- **`listPlatformAdminAuditLog(limit = 100)`** — the audit trail below,
  capped at 500 per call.

Every write path (`suspendOrganization`, `reactivateOrganization`,
`addSupportNote`) records a `platform_admin_audit_log` row inside the same
transaction as the write it's auditing, via the internal
`recordPlatformAdminAction()` helper — never a best-effort call after the
fact.

## Organization suspension reuses `organizations.archived_at`

`suspendOrganization()` sets `organizations.archived_at`, the same column
Phase 21's self-service organization deletion/archival path uses.
`getCurrentOrganization()` (`src/lib/authz.ts`) already filters
`archived_at is null` on every request that resolves an organization, so
suspension takes effect immediately, for every member, without a second,
independently-tested access-blocking mechanism. `platform_suspensions`
carries the audit trail (who, when, why, and — on reactivation — who
lifted it and when); a partial unique index
(`where reactivated_at is null`) prevents more than one active suspension
per organization at the database layer, and `suspendOrganization()`
translates that constraint violation into a clear `409 conflict`
`AppError` rather than a raw database error.

## Data model (`supabase/migrations/20260808000001_platform_administration.sql`)

Three new tables, none of them granted to the `authenticated` Postgres
role at all (`revoke all ... from anon, public, authenticated`):

- **`platform_admin_audit_log`** — no `organization_id` column; append-only,
  cross-tenant by design. Deliberately exempt from the "every tenant-owned
  table has `organization_id` + RLS + an index" rule
  `schema-coverage.test.ts` enforces, because it isn't tenant-owned data.
- **`platform_suspensions`** — has `organization_id`, RLS enabled, and a
  `deny_all` (`using (false)`) select policy. The policy is never actually
  reachable by a normal session (the table has no grant to
  `authenticated` at all), but it exists so
  `schema-coverage.test.ts`'s static "≥1 policy per tenant-owned table"
  check has something real to find — documenting the intended-always-deny
  posture explicitly rather than relying solely on the missing grant.
- **`platform_support_notes`** — same `organization_id` + RLS +
  `deny_all` pattern as `platform_suspensions`.

`src/lib/db/schema-coverage.test.ts`'s expected table count was updated
(82 → 85) to include the two tenant-owned tables; the audit log is
excluded from that count for the reason above.

## UI (`src/app/app/(protected)/platform-admin/`)

- **`/app/platform-admin`** — dashboard: health overview, organization
  count, active suspensions.
- **`/app/platform-admin/organizations`** — search/list.
- **`/app/platform-admin/organizations/[organizationId]`** — detail page:
  suspend/reactivate, add a support note, recent tenant audit activity.
- **`/app/platform-admin/users`** — email lookup, linking into each
  membership's organization detail page.
- **`/app/platform-admin/audit-log`** — the platform-admin audit trail
  itself.

Every page loads its data server-side and catches `AppError`, rendering
an "Access denied" `Alert` rather than a generic crash when
`requirePlatformAdmin()` rejects the caller — there is no client-side-only
gate anywhere in this surface; hiding the nav entry (not implemented in
this pass — see Known gaps) would be UX, not access control, and the
server-side check is what actually enforces the boundary regardless.

## Security

- **Server-side authorization on every function** — `requirePlatformAdmin()`
  is the first line of every exported service function; there is no
  UI-only gate.
- **Structurally separate from tenant authorization** — see "Core
  security property" above; covered by both
  `src/lib/platform-admin.test.ts` (the allowlist/authorization logic
  itself) and `src/lib/services/platform-admin.test.ts` (a
  forbidden-propagates-from-every-function negative test).
- **Full audit trail** — every write records a `platform_admin_audit_log`
  row in the same transaction as the write, capturing actor, action,
  target organization/profile, reason, and metadata. The log itself is
  append-only from the application's perspective (no update/delete
  function exists in the service layer).
- **No silent bypass of tenant controls** — suspension acts through the
  same `archived_at is null` gate a tenant's own archival would use, not
  a separate, parallel blocking mechanism that could drift out of sync
  with it.

## Known gaps

- **Impersonation was not implemented in this pass.** The original phase
  brief allowed "safe impersonation only if strongly justified," gated by
  approval, audit, expiration, and a customer-visible indication. No such
  mechanism exists in this codebase — `lookupUserByEmail()` returns
  read-only profile/membership data, and there is no code path that
  authenticates a platform admin as another user's session. If
  impersonation is needed later, it requires its own dedicated security
  review (session-boundary handling, expiry, and a customer-visible
  banner) rather than a quick addition to this surface.
- **No pagination** on `listOrganizationsForPlatformAdmin()` (capped at
  200) or `listPlatformAdminAuditLog()` (capped at 500) — acceptable at
  current scale, not built for arbitrary growth.
- **No dedicated "emergency access" workflow** beyond the standard
  allowlist — the phase brief's "emergency access" item is satisfied by
  the same `PLATFORM_ADMIN_EMAILS` mechanism as routine access; there is
  no separate break-glass path with its own audit posture.
- **No operational dashboards beyond `getPlatformHealthOverview()`** — it
  re-exposes Phase 23's queue/provider health, not a new metrics surface.
- **RLS cross-tenant proof remains unverified against a live database
  engine**, consistent with every prior phase's documented posture (see
  [organization-administration.md](organization-administration.md)'s
  "Known gaps") — `tenant-isolation.integration.test.ts` has not been run
  against a real Supabase project in this environment.

## Related documents

- [Authentication and authorization](authentication-and-authorization.md)
- [Observability](observability.md)
- [Organization administration](organization-administration.md)
- [Backlog](../project/backlog.md)
