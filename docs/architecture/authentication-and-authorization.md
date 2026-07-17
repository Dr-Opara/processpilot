# Authentication and Authorization

## Authentication

Clerk provides identity and organization membership (see
[ADR-0003](decisions/0003-clerk-identity.md)). Planned shape:

- Every authenticated user has a Clerk identity.
- Organization membership (which `Organization`(s) a user belongs to, and
  their role(s) within each) is modeled using Clerk Organizations, kept in
  sync with ProcessPilot's own `Member`/`Role` records (see
  [domain model](domain-model.md)).
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
[product/permissions-matrix.md](../../product/permissions-matrix.md).

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

## Session and token handling (planned)

- Session tokens are managed by Clerk's SDKs; ProcessPilot application
  code does not hand-roll session/token storage.
- Any server-only credential capable of elevated data access (e.g. a
  Supabase service role key) is read only from server-side environment
  configuration (see [environment-variables.md](../development/environment-variables.md))
  and is never exposed to client bundles.

## Related documents

- [User roles](../../product/user-roles.md)
- [Permissions matrix](../../product/permissions-matrix.md)
- [Multi-tenancy](multi-tenancy.md)
- [ADR-0003: Clerk for identity and organization membership](decisions/0003-clerk-identity.md)
