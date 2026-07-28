# Integration Architecture

Covers third-party integrations configurable by an organization (Phase
18), distinct from the core managed-services stack (Clerk, Supabase,
Stripe, Vercel) described in [system overview](system-overview.md).

## Provider-neutral adapter pattern

Three cross-cutting concerns are built behind provider-neutral adapter
interfaces so the underlying vendor can change without a business-logic
rewrite:

- **Email** — transactional notifications (assignment, approval,
  deadline, exception alerts).
- **Background jobs / queues** — see [event model](event-model.md).
- **AI** — see [AI architecture](ai-architecture.md).

Each adapter defines a stable interface consumed by application code;
provider-specific implementation (API keys, request shape, vendor SDKs)
is isolated behind that interface, configured via environment variables
documented in [environment-variables.md](../development/environment-variables.md).

## Organization-configurable integrations (Phase 18)

Distinct from the adapters above, this category covers integrations an
individual customer organization opts into. Design principles:

- Configuration is per-organization and admin-gated (`integration.manage`,
  see [permissions matrix](../../product/permissions-matrix.md)).
- Credentials for a customer's third-party integration are stored
  encrypted at rest and never exposed to the browser or to other
  organizations.
- An integration failure degrades gracefully — it must not block core
  product-loop functionality (e.g. a broken SSO integration should not
  prevent password/Clerk-native sign-in as a fallback path, if enabled).

### Implementation: SSO/SAML

Phase 18's initial concrete integration — chosen (no design-partner
feedback existed to draw from; see
[phase-tracker.md](../project/phase-tracker.md)'s Phase 18 entry) for
its fit with [product/user-roles.md](../../product/user-roles.md)'s
`external_user` role and the Enterprise-tier hypothesis in
[pricing-hypotheses.md](../../product/pricing-hypotheses.md), which
already lists SSO as an Enterprise inclusion.

`src/lib/services/sso.ts` is deliberately a thin admin wrapper over
**Clerk's Enterprise Connections API**
(`clerkClient().enterpriseConnections` — `@clerk/backend`), not a
from-scratch SAML/OIDC implementation. Per
[ADR-0003](decisions/0003-clerk-identity.md), Clerk is already the sole
identity provider; its Enterprise Connections API performs the actual
SAML/OIDC handshake _and_ stores the IdP credential material (X.509
certificate, OIDC client secret, metadata) on Clerk's side. This
resolves the "credentials stored encrypted at rest" principle above
without ProcessPilot building or operating a second secret store: a
locally-persisted copy of that material would be a redundant, strictly
worse-security duplicate, not an improvement.

`sso_connections` (`20260803000001_sso_connections.sql`) therefore
holds **no IdP secret material at all** — only a label
(`name`/`provider`/`domain`/`active`) so ProcessPilot's own admin UI
(`/app/sso`) and audit trail (`AuditAction.SsoConnectionCreated`/
`Updated`/`Deleted`, always excluding certificate/secret fields from
audit metadata) can show what's configured. The certificate/client
secret submitted through `/app/sso`'s form is forwarded directly to
Clerk's API and never touches ProcessPilot's own database.

Graceful degradation is inherent, not something this module
implements: Clerk's native email/password sign-in remains available
regardless of whether an organization has an SSO connection configured
— this integration only ever _adds_ a domain-scoped enterprise
connection, it never disables Clerk's other sign-in strategies.

Unlike the AI/email/billing adapters, **no new environment variable
gates this integration** — it reuses the `CLERK_SECRET_KEY` already
configured and working since Phase 3 (real, not a placeholder, in
every environment where sign-in itself works). The one real caveat:
Clerk's Enterprise Connections feature may require a paid Clerk plan
tier; a plan that doesn't include it surfaces as a normal Clerk API
error, caught and re-thrown as an `AppError`, not a special-cased
"not configured" state, since there is nothing this codebase can check
in advance the way it checks for a placeholder API key.

**Known gaps:** only the `saml_custom`/`oidc_custom` provider types are
supported in `/app/sso`'s form — Clerk's convenience providers
(`saml_google`, `saml_microsoft`, `saml_okta`, which pre-fill some
fields on Clerk's own dashboard) aren't special-cased, since the
underlying API call is identical either way and a v1 admin can still
configure any of them as a custom SAML connection. Live behavior
against a real Clerk Enterprise Connections-enabled instance is
untested by this phase's automated suite (which mocks
`clerkClient().enterpriseConnections` entirely) — manual verification
against a real Clerk organization is the next step before relying on
this in production.

## Public API (future)

ProcessPilot does not expose a public API as of Phase 0. If/when one is
built (tracked against Phase 18), it will be versioned explicitly and
documented separately from this architecture document, and will be
subject to the same [multi-tenancy](multi-tenancy.md) and
[authentication and authorization](authentication-and-authorization.md)
rules as the rest of the application — no separate, weaker auth path for
API consumers.

## Related documents

- [System overview](system-overview.md)
- [Event model](event-model.md)
- [AI architecture](ai-architecture.md)
- [Feature catalog — integrations](../../product/feature-catalog.md)
