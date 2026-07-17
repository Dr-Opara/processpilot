# Billing Architecture

Implemented in Phase 17 (Billing and entitlements), backed by Stripe (see
[ADR-0007](decisions/0007-stripe-billing.md)). This document defines the
target shape; nothing described here is implemented as of Phase 0.

## Responsibilities

1. **Subscription management** — plan selection, upgrades/downgrades,
   cancellation, backed by Stripe Billing/Checkout/Customer Portal rather
   than a hand-rolled payment flow.
2. **Entitlement resolution** — translating an organization's active
   subscription plan into concrete `Entitlement` records (see
   [domain model](domain-model.md)) consumed by application code (seat
   limits, feature gates, storage quotas).
3. **Webhook handling** — reacting to Stripe events (payment success/
   failure, subscription changes) to keep entitlements in sync with the
   billing system of record (Stripe), not a locally-drifting copy.

## Ownership and access

- `billing.manage` (see [permissions matrix](../../product/permissions-matrix.md))
  is the only permission that can view or change subscription/payment
  details — scoped to `organization_owner` by default.
- Stripe customer/subscription identifiers are stored against the owning
  `Organization`; billing data is tenant-scoped like any other record
  (see [multi-tenancy](multi-tenancy.md)), with the same server-side
  verification requirements.

## Entitlement enforcement

- Entitlement checks (seat count, feature access, storage/usage limits)
  are enforced server-side at the point of the gated action (e.g.
  inviting a member beyond the seat limit is rejected server-side, not
  merely hidden in the UI) — consistent with
  [authentication and authorization — non-negotiable rules](authentication-and-authorization.md).
- A lapsed or canceled subscription degrades access predictably (defined
  precisely during Phase 17 design) rather than deleting data — data
  retention on downgrade/cancellation follows the same principle as
  [data ownership — deletion](data-ownership.md).

## Secrets

Stripe secret keys and webhook signing secrets are server-only
environment variables (see
[environment-variables.md](../development/environment-variables.md)) —
test-mode keys in Preview, live keys only in Production, per
[SECURITY.md](../../SECURITY.md).

## Related documents

- [Pricing hypotheses](../../product/pricing-hypotheses.md) — commercial
  model this architecture must support (not yet committed).
- [ADR-0007: Stripe billing](decisions/0007-stripe-billing.md)
- [Multi-tenancy](multi-tenancy.md)
