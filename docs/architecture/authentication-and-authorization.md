# Authentication and Authorization

## Authentication

Clerk provides identity and organization membership (see
[ADR-0003](decisions/0003-clerk-identity.md)), implemented in Phase 3:

- Every authenticated user has a Clerk identity. Sign-up/sign-in are
  Clerk's prebuilt `<SignIn>`/`<SignUp>` components, re-themed to
  design/components.md (see `src/lib/clerk-appearance.ts`), served at
  `/app/sign-in` and `/app/sign-up`.
- Organization membership (which `Organization`(s) a user belongs to, and
  their role(s) within each) is modeled using Clerk Organizations
  (creation, invitation, and member management via `<CreateOrganization>`
  and `<OrganizationProfile>`), **kept in sync with ProcessPilot's own
  `organization_members`/`roles` records (see
  [domain model](domain-model.md) and
  [clerk-supabase-identity-sync.md](clerk-supabase-identity-sync.md)) as
  of Phase 4**. Clerk's own `org:admin`/`org:member` roles (stored as
  `organization_members.clerk_role`) remain the source of truth for
  Clerk's own UI (`<OrganizationProfile>`) but are never treated as
  authoritative for ProcessPilot permission checks — every
  `requirePermission()` call resolves against the real
  `role_permissions`/`member_role_assignments` tables instead.
- The `/api/webhooks/clerk` route verifies, acknowledges, and (as of
  Phase 4) persists Clerk organization/membership/user events into
  ProcessPilot's own tables — idempotently, inside a transaction, with an
  audit event per change. See
  [clerk-supabase-identity-sync.md](clerk-supabase-identity-sync.md) for
  the full mapping and idempotency model.
- The authenticated app lives at `app.processpilot.com` in production
  (see [deployment-architecture.md](deployment-architecture.md)); until a
  custom domain is configured, `/app/*` paths serve the same routes
  directly, which is also how Codespaces/Playwright/Vercel-preview reach
  them.
- `external_user` sessions (see [user roles](../../product/user-roles.md))
  use a lighter-weight, resource-scoped authentication flow — not a full
  Clerk organization membership — appropriate to one-off, invitation-based
  access. The exact mechanism is designed in Phase 19 (External portal).
- ProcessPilot support employees (Phase 27) authenticate through a
  separate, internal-only path and never hold a standing role inside a
  customer organization's tenant.

## Authorization

Authorization is **role- and permission-based**, defined in
[product/user-roles.md](../../product/user-roles.md) and
[product/permissions-matrix.md](../../product/permissions-matrix.md), and
enforced by `src/lib/authz.ts`'s `requirePermission()` — built on Phase 3's
`src/lib/auth.ts`'s `requireAuth()` (session verification, unchanged) plus
Phase 4's `organization_members`/`roles`/`role_permissions` tables.
`requirePermission(permission)` resolves the caller's active membership
and checks their _unscoped_ ("✓") permission grants; a caller lacking the
permission gets `AppError("forbidden", ...)`, normalized by
`src/lib/errors.ts` into a safe HTTP response that never leaks a raw
database error.

### Non-negotiable rules

1. **Server-enforced, always.** Every API route, server action, and data
   query that touches a protected resource checks the caller's effective
   permissions and scope on the server before acting. The client is never
   trusted to self-report what it's allowed to do.
2. **No security-relevant logic in the UI alone.** Hiding a button is a
   UX convenience, never a security control. If a permission check would
   only exist in client-side rendering logic, it is missing — add the
   server-side check first.
3. **Scope travels with the permission.** A permission check is only
   correct when it also verifies the resource is within the caller's
   granted scope (organization, and where applicable, location/
   department/team/ownership) — see
   [permissions matrix — enforcement rules](../../product/permissions-matrix.md).
4. **Immediate effect on change.** Role changes, permission changes, and
   membership suspension/removal take effect on the very next request.
   Any session or permission cache introduced later must have a
   revocation path that meets this bar — no fixed TTL is acceptable on
   its own if it could allow stale elevated access.
5. **No self-escalation.** A member cannot grant themselves or a custom
   role a permission their own current role doesn't already hold.
6. **Defense in depth with the database layer.** Application-layer
   authorization and PostgreSQL Row-Level Security (see
   [multi-tenancy](multi-tenancy.md)) are independent, redundant controls
   — a bug in one must not be sufficient for a breach.

## Session and token handling

- Session tokens are managed by Clerk's SDKs; ProcessPilot application
  code does not hand-roll session/token storage.
- Any server-only credential capable of elevated data access (e.g. a
  Supabase service role key) is read only from server-side environment
  configuration (see [environment-variables.md](../development/environment-variables.md))
  and is never exposed to client bundles.

## Known limitations

- **Scoped permission grants are not yet enforced.** `product/permissions-matrix.md`
  marks some grants "Scoped" (e.g. a `manager`'s `department.manage`,
  narrowed to the department/location/team they manage) rather than
  organization-wide. The data model for _which_ department/location/team a
  manager manages doesn't exist until Phase 5 (Business onboarding and
  employee management). Until then, `requirePermission()` and RLS policies
  only recognize a member's _unscoped_ grants — a manager currently gets
  no write access to `departments`/`teams`/`organization_members` at all
  via this path, rather than incorrectly organization-wide access. This is
  a deliberate under-provisioning, not an oversight; Phase 5 is expected
  to close this gap.
- **Custom roles are schema-ready but not implemented.** `roles.organization_id`
  is nullable specifically so Phase 21 (Organization administration) can
  add custom, org-scoped roles without a breaking schema change. No UI or
  service exists yet to create one.

## Related documents

- [User roles](../../product/user-roles.md)
- [Permissions matrix](../../product/permissions-matrix.md)
- [Multi-tenancy](multi-tenancy.md)
- [Clerk↔Supabase identity sync](clerk-supabase-identity-sync.md)
- [Database schema](database-schema.md)
- [ADR-0003: Clerk for identity and organization membership](decisions/0003-clerk-identity.md)
