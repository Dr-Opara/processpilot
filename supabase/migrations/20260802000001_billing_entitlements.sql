-- Phase 17 (Billing and entitlements): Stripe as the billing system of
-- record (ADR-0007) — subscriptions/billing_webhook_events mirror
-- Stripe state for read access; they are never written to directly by
-- app-initiated actions (checkout, cancel, portal), only by the
-- webhook handler (src/app/api/webhooks/stripe/route.ts), so there is
-- no dual-write race between an optimistic local update and the
-- eventual webhook. See docs/architecture/billing-architecture.md.

alter table organizations add column stripe_customer_id text unique;

-- subscriptions: one row per Stripe subscription. A partial unique
-- index (not a plain one) enforces "at most one non-terminal
-- subscription per organization" while still letting historical
-- canceled/incomplete_expired rows accumulate — the same "final states
-- don't block a new row" shape as capa_plans/temporary_waivers.
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  stripe_subscription_id text not null unique,
  stripe_price_id text not null,
  -- Working-hypothesis plan keys from product/pricing-hypotheses.md
  -- (NOT committed pricing — see billing.ts's PLAN_ENTITLEMENTS doc
  -- comment). Left as free text, not a check constraint enum, so a
  -- plan rename doesn't require a migration.
  plan_key text not null,
  status text not null check (
    status in ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'paused', 'unpaid')
  ),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  trial_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index subscriptions_active_per_org_idx
  on subscriptions(organization_id)
  where status not in ('canceled', 'incomplete_expired');
create index subscriptions_organization_id_idx on subscriptions(organization_id);

create trigger subscriptions_set_updated_at
  before update on subscriptions
  for each row execute function set_updated_at();

alter table subscriptions enable row level security;

-- billing.manage is the only permission that can view or change
-- subscription/payment details (billing-architecture.md), scoped to
-- organization_owner by the seeded role_permissions — unscoped, so a
-- plain has_permission() check is correct here (contrast Phase 15's
-- audit_events fix, where a genuinely *scoped* grant needed
-- has_scoped_permission()).
create policy subscriptions_select on subscriptions
  for select
  using (organization_id = current_org_id() and has_permission('billing.manage'));

-- No insert/update/delete grant to `authenticated` at all — every
-- write comes from the Stripe webhook handler via the admin client,
-- per this migration's header comment.
revoke all on subscriptions from anon, public, authenticated;
grant select on subscriptions to authenticated;

-- billing_webhook_events: the Stripe-event counterpart to
-- webhook_events (Clerk-specific by column name, see
-- 20260719130005's header comment) — same idempotency shape: a failed
-- attempt still gets its own row, only one 'processed' row per
-- stripe_event_id is ever allowed.
create table billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null,
  event_type text not null,
  status text not null default 'processed' check (status in ('processed', 'failed')),
  organization_id uuid references organizations(id),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text
);

create unique index billing_webhook_events_processed_idx
  on billing_webhook_events(stripe_event_id)
  where status = 'processed';
create index billing_webhook_events_stripe_event_id_idx on billing_webhook_events(stripe_event_id);
create index billing_webhook_events_organization_id_idx
  on billing_webhook_events(organization_id)
  where organization_id is not null;

alter table billing_webhook_events enable row level security;

create policy billing_webhook_events_select on billing_webhook_events
  for select
  using (organization_id = current_org_id() and has_permission('billing.manage'));

revoke all on billing_webhook_events from anon, public, authenticated;
grant select on billing_webhook_events to authenticated;
