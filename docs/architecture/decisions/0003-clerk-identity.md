# ADR-0003: Clerk for identity and organization membership

## Status

Proposed — not yet integrated. Implemented in Phase 3 (Authentication and
organizations).

## Context

ProcessPilot needs multi-tenant authentication with organization
membership, roles, invitations, and session management, without building
and maintaining a custom auth system for a product whose value is process
governance, not identity infrastructure. See
[multi-tenancy.md](../multi-tenancy.md) and
[user-roles.md](../../../product/user-roles.md).

## Decision

Use Clerk for identity (sign-up, sign-in, session management) and Clerk
Organizations for tenant/membership modeling, synced with ProcessPilot's
own `Member`/`Role` records (see [domain-model.md](../domain-model.md))
for product-specific role and permission data Clerk doesn't natively
model.

## Alternatives considered

- **Hand-rolled auth (credentials + sessions in the app database).**
  Rejected: significant, ongoing security surface area (password storage,
  session fixation, MFA, SSO) for a non-differentiating part of the
  product; higher risk of authentication-layer vulnerabilities.
- **NextAuth.js / Auth.js.** Rejected for this phase: requires more
  custom work to model organization membership and B2B invitation flows
  compared to Clerk's built-in Organizations feature, which maps closely
  to ProcessPilot's `Organization`/`Member` model.
- **A different managed identity provider (Auth0, WorkOS).** Considered
  viable alternatives; Clerk was chosen for its Next.js-first developer
  experience and native organizations feature, consistent with the
  chosen framework ([ADR-0002](0002-nextjs-app-router.md)). This decision
  can be revisited before Phase 3 implementation begins if evaluation
  surfaces a blocker.

## Consequences

- Reduces custom authentication code and associated security risk.
- Couples the identity layer to a specific vendor — mitigated by keeping
  ProcessPilot's own authorization logic (permissions, scoping) in the
  application layer rather than fully inside Clerk-specific constructs,
  per [authentication-and-authorization.md](../authentication-and-authorization.md).
- External user access (see
  [user-roles.md — external_user](../../../product/user-roles.md))
  requires a lighter-weight flow than full Clerk organization membership,
  designed separately in Phase 19.

## Security implications

Session and token handling is delegated to Clerk's SDKs rather than
hand-rolled. Server-side verification of organization membership remains
mandatory per [multi-tenancy.md](../multi-tenancy.md) — Clerk establishes
identity and membership; ProcessPilot's own server code still verifies
scope and permission on every request.

## Revisit conditions

Revisit if Clerk pricing at scale, feature limitations for custom roles,
or a required identity feature (e.g. specific enterprise SSO/SCIM needs
for a large customer) cannot be met before or during Phase 3
implementation.
