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
individual customer organization opts into — for example, connecting an
identity provider for SSO, or a communication tool for notification
delivery. Design principles (finalized in Phase 18, stated here as
constraints that must hold when it's designed):

- Configuration is per-organization and admin-gated (`integration.manage`,
  see [permissions matrix](../../product/permissions-matrix.md)).
- Credentials for a customer's third-party integration are stored
  encrypted at rest and never exposed to the browser or to other
  organizations.
- An integration failure degrades gracefully — it must not block core
  product-loop functionality (e.g. a broken SSO integration should not
  prevent password/Clerk-native sign-in as a fallback path, if enabled).

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
