# ADR-0007: Stripe billing

## Status

Accepted. Implemented in Phase 17 (Billing and entitlements) — see
[billing-architecture.md](../billing-architecture.md)'s "Implementation"
section. No real Stripe credentials exist in this environment; live
billing operations are unverified end-to-end until
`STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` are supplied, and the plan
tiers/prices wired in are unvalidated hypotheses, not committed
pricing — see that document's "Known gaps and pending decisions."

## Context

ProcessPilot needs subscription billing (plans, seats, upgrades/
downgrades, invoicing) without building payment processing, PCI
compliance handling, or subscription lifecycle logic from scratch. See
[billing-architecture.md](../billing-architecture.md) and
[pricing-hypotheses.md](../../../product/pricing-hypotheses.md).

## Decision

Use Stripe (Billing, Checkout, Customer Portal, and webhooks) as the
billing system of record, with ProcessPilot's own `Entitlement` records
(see [domain-model.md](../domain-model.md)) derived from Stripe
subscription state rather than tracked independently as a second source
of truth.

## Alternatives considered

- **Hand-rolled payment processing.** Rejected outright — PCI compliance
  burden and security risk are disproportionate to the value of building
  this in-house for a company whose product is process governance, not
  payments.
- **Paddle or another merchant-of-record billing provider.** Considered;
  Stripe was chosen for broader ecosystem familiarity, more granular
  usage-based billing support (relevant to the seat + usage-guardrail
  pricing hypothesis), and stronger Next.js/webhook tooling precedent.

## Consequences

- Stripe is the source of truth for subscription/payment state; the
  application reacts to Stripe webhooks rather than maintaining
  independent billing logic that could drift out of sync.
- `billing.manage` (see
  [permissions-matrix.md](../../../product/permissions-matrix.md)) gates
  all billing UI and API surface area.
- Ties commercial operations to Stripe's supported countries/currencies
  and fee structure — accepted as standard for a company at this stage.

## Security implications

Stripe secret keys and webhook signing secrets are server-only
environment variables, test-mode only in Preview, live only in
Production, per
[environment-variables.md](../../development/environment-variables.md)
and [SECURITY.md](../../../SECURITY.md). No card data touches
ProcessPilot's own servers directly (Stripe-hosted Checkout/Portal or
Stripe Elements handle sensitive payment data).

## Revisit conditions

Revisit if Stripe cannot support a required pricing model validated in
[pricing-hypotheses.md](../../../product/pricing-hypotheses.md), or a
specific market/currency requirement Stripe doesn't cover.
