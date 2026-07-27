# Billing Architecture

Backed by Stripe (ADR-0007, Accepted). Implemented in Phase 17
([src/lib/billing/](../../src/lib/billing/),
[src/lib/services/billing.ts](../../src/lib/services/billing.ts),
[src/app/api/webhooks/stripe/route.ts](../../src/app/api/webhooks/stripe/route.ts)).

## No real Stripe credentials are configured in this environment

Same posture as Phase 13's `ANTHROPIC_API_KEY` and Phase 16's
`EMAIL_PROVIDER_API_KEY`: only placeholder `STRIPE_SECRET_KEY`/
`STRIPE_WEBHOOK_SECRET` values exist in `.env.local`. Everything in
this phase is built and tested against deterministic mocks; live
checkout, portal, cancellation, and webhook processing are unverified
end-to-end until real credentials are supplied. **Live billing
operations are not marked production-verified by this phase.**

## Pricing is not committed — read this before wiring anything to a real price

`product/pricing-hypotheses.md` is explicitly "hypotheses, not
committed pricing," with several open questions still unresolved (seat-
billing basis, AI-usage unit, annual/monthly discount structure). This
phase's own entry criteria required "pricing... promoted out of
pricing-hypotheses.md into committed pricing" — that promotion has not
happened. Per explicit instruction, this phase proceeds anyway, using
the hypothesis tiers **only as swappable configuration for the
entitlement mechanism**, never as real customer-facing pricing:

- `src/lib/billing/plans.ts`'s `PLAN_ENTITLEMENTS` transcribes the
  three working tiers (Starter/Business/Enterprise) verbatim from
  pricing-hypotheses.md, with every label suffixed `(hypothesis)` and a
  file-level comment stating this is unvalidated.
- Nothing in `/app/billing` or anywhere else presents a dollar amount —
  there isn't one to show; Stripe's own Checkout/Portal pages (which
  ProcessPilot never re-implements, see below) are the only place a
  price would ever render, and only once a real price id is configured.
- `getStripePriceId(planKey)` reads `STRIPE_PRICE_ID_<PLAN>` from the
  environment rather than hardcoding an id — unset until a real Stripe
  product/price catalog exists.

**To replace hypothesis pricing with committed pricing later:** update
`PLAN_ENTITLEMENTS` in `plans.ts` (seat limits, AI-usage allowances,
feature sets) to the approved values, create the corresponding
products/prices in the Stripe dashboard, and set the three
`STRIPE_PRICE_ID_*` environment variables. No schema change is
required — `subscriptions.plan_key` is free text, not an enum, exactly
so a plan rename or restructure doesn't need a migration.

## Provider-neutral billing adapter

`src/lib/billing/adapter.ts` defines `BillingProvider` (customer
creation, checkout session, billing portal session, subscription
cancellation, webhook verification), mirroring
[ai-architecture.md](ai-architecture.md)'s and
[notifications.md](notifications.md)'s adapter pattern (ADR-0008).
Every method returns ProcessPilot's own normalized shape, never a raw
`Stripe.*` type, so a provider swap can't leak a vendor-specific shape
into calling code. `providers/stripe-provider.ts` is the one concrete
implementation, using the `stripe` npm SDK (unlike the email adapter's
hand-rolled `fetch` call — Stripe's API surface, especially webhook
signature verification, is large enough that the SDK earns its place
as a dependency, same reasoning `@anthropic-ai/sdk` did in Phase 13).
`get-provider.ts` is the one place that names a concrete provider.

`availability.ts`'s `isBillingConfigured()` treats
`STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` as unset when either is
missing, empty, or still the literal `.env.local` placeholder — the
same check every other provider-neutral adapter in this codebase uses.

## Stripe is the source of truth — no dual writes

Per ADR-0007, `subscriptions` is a read-optimized mirror of Stripe
state, never written to directly by an app-initiated action.
`billing.ts`'s `createCheckoutSessionUrl()`/`createBillingPortalUrl()`/
`cancelCurrentSubscription()` call the Stripe adapter and return a
redirect URL (or, for cancellation, just call the adapter); they never
touch the `subscriptions` table. The only writer is
`src/app/api/webhooks/stripe/route.ts`, reacting to
`customer.subscription.created`/`updated`/`deleted` events — this
avoids the race between an optimistic local update and the eventual
webhook that a dual-write design would introduce. ProcessPilot never
re-implements Stripe Checkout, the Billing Portal, or card handling —
every payment surface is Stripe-hosted.

Webhook idempotency mirrors
[clerk-supabase-identity-sync.md](clerk-supabase-identity-sync.md)'s
`webhook_events` pattern exactly: `billing_webhook_events`'s
`stripe_event_id` is inserted under a partial unique index (`where
status = 'processed'`) before any sync logic runs, so a concurrent or
retried delivery of the same event loses the race and is acknowledged
as already-processed.

## Entitlements are derived, not persisted

Per ADR-0007 ("`Entitlement` records derived from Stripe subscription
state rather than tracked independently as a second source of truth"),
there is no `entitlements` table. `billing.ts`'s `getEntitlements()`
reads the organization's current non-terminal subscription's
`plan_key` and resolves it through the static `PLAN_ENTITLEMENTS`
config — an organization with no subscription at all defaults to
Starter, not "no access." A `past_due`/`unpaid` subscription still
resolves to its plan's entitlements; Stripe (via dunning, not this
app) decides when non-payment actually suspends access.

`getEntitlements()` reads through the admin client rather than
`withTenantContext()`: it only ever returns a plan-key-derived
entitlement shape, never a raw subscription/payment row, so it doesn't
need — and would be wrongly blocked by — `subscriptions_select`'s
`billing.manage`-only RLS policy. Every enforcement call site (e.g. a
manager with `member.invite` but not `billing.manage` inviting someone)
needs to resolve entitlements regardless of whether the caller happens
to also hold `billing.manage`.

## Enforcement: seats

`invitations.ts`'s `createInvitation()` calls `requireSeatAvailable()`
before creating a Clerk invitation — the flagship, explicitly-named
example from this document's original design ("inviting a member
beyond the seat limit is rejected server-side, not merely hidden in
the UI"). Seats are counted from `organization_members` where
`status = 'active'`; an `Enterprise`-tier `maxSeats: null` never blocks.

## Usage tracking: AI requests (read-only, not yet enforced)

`getAiUsageForCurrentPeriod()` counts the current calendar month's
`ai_usage_events` rows (Phase 13) — visible on `/app/billing` as a
usage figure, but **not** hard-enforced against
`PLAN_ENTITLEMENTS[...].aiRequestsPerMonth` anywhere yet. See known
gaps below for why.

## Ownership and access

`billing.manage` (organization_owner only, unscoped — see
`product/permissions-matrix.md`) gates every subscription read/write
surface: `getCurrentSubscription()`, `getSeatUsage()`,
`getAiUsageForCurrentPeriod()`, and the three action functions.
`getEntitlements()`/`requireSeatAvailable()` are deliberately the
exception (see above).

## UI

`/app/billing` (`src/app/app/(protected)/billing/page.tsx`) — current
plan/status, seat and AI-usage figures, subscribe/manage/cancel
actions. A prominent banner states the pricing-hypothesis disclaimer on
every load, not just in code comments; a second banner explains the
"billing not configured" state when `isBillingConfigured()` is false,
disabling every action button rather than letting them fail
confusingly.

## Known gaps and pending decisions

- **Pricing is not committed** (see above) — the single largest gap.
  Nothing here should be read as ProcessPilot's actual go-to-market
  pricing.
- **AI-usage quota is tracked but not enforced** — `getAiUsageForCurrentPeriod()`
  exposes the figure; there is no block once a plan's
  `aiRequestsPerMonth` is exceeded. Wiring a hard stop into
  `ai-*.ts`'s adapter call sites is deferred until pricing is committed,
  to avoid retrofitting a real limit on top of a hypothesis number.
- **No invoice/payment history UI** — Stripe's own Billing Portal
  (reachable via "Manage billing") is the source for that; this phase
  doesn't duplicate it in-app.
- **`past_due`/`unpaid` doesn't yet degrade access** — such a
  subscription still resolves full entitlements (see above) rather than
  a separate degraded-access state, which the original design doc
  flagged as "defined precisely during Phase 17 design" — deferred
  pending a committed pricing/dunning policy, not implemented as a
  placeholder behavior here.
- **Seat enforcement covers single invitations only** — the bulk member
  CSV import path (`member-import.ts`) is not gated the same way,
  documented here rather than silently inconsistent.
- **Live Stripe operations are unverified** (see above).

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
- [AI architecture](ai-architecture.md) / [Notifications](notifications.md) —
  the sibling provider-neutral adapters this one's structure mirrors
- [Multi-tenancy](multi-tenancy.md)
