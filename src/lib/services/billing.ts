import "server-only";
import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { getAdminSql } from "@/lib/db/client-admin";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import { isBillingConfigured } from "@/lib/billing/availability";
import { getBillingProvider } from "@/lib/billing/get-provider";
import {
  getStripePriceId,
  resolveEntitlements,
  type PlanEntitlements,
  type PlanKey,
} from "@/lib/billing/plans";
import type { SubscriptionRow } from "@/lib/db/database.types";

/**
 * Billing/entitlements read and action surface. Per ADR-0007, Stripe is
 * the system of record: every app-initiated action here (checkout,
 * portal, cancel) calls the billing adapter and lets the resulting
 * webhook (src/app/api/webhooks/stripe/route.ts) update `subscriptions`
 * — this module never writes to that table directly, avoiding a
 * dual-write race between an optimistic local update and the webhook.
 */

function toTenantContext(membership: {
  organization: { id: string };
  member: { id: string };
  profile: { clerk_user_id: string };
}) {
  return {
    organizationId: membership.organization.id,
    memberId: membership.member.id,
    clerkUserId: membership.profile.clerk_user_id,
  };
}

/** billing.manage-gated — the full subscription row, for the billing settings page. */
export async function getCurrentSubscription(): Promise<SubscriptionRow | null> {
  const membership = await requirePermission("billing.manage");
  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [subscription] = await tx<SubscriptionRow[]>`
      select * from subscriptions
      where organization_id = ${membership.organization.id}
        and status not in ('canceled', 'incomplete_expired')
      order by created_at desc
      limit 1
    `;
    return subscription ?? null;
  });
}

/**
 * Not permission-gated beyond "is an active member of this
 * organization" — every enforcement call site (e.g. invitations.ts's
 * seat check) needs to resolve entitlements regardless of whether the
 * caller happens to also hold billing.manage. Reads through the admin
 * client rather than withTenantContext(): this only ever returns a
 * plan_key/entitlement shape, never raw subscription/payment details,
 * so it doesn't need (and would be wrongly blocked by)
 * subscriptions_select's billing.manage-only RLS policy.
 */
export async function getEntitlements(organizationId?: string): Promise<PlanEntitlements> {
  const orgId = organizationId ?? (await getCurrentMembership()).organization.id;
  const sql = getAdminSql();
  const [subscription] = await sql<{ plan_key: string; status: string }[]>`
    select plan_key, status from subscriptions
    where organization_id = ${orgId} and status not in ('canceled', 'incomplete_expired')
    order by created_at desc
    limit 1
  `;
  // A past_due/unpaid subscription still resolves to its plan's
  // entitlements (Stripe, not this app, decides when to actually
  // suspend for non-payment) — only a canceled/never-existing
  // subscription falls back to the default plan.
  return resolveEntitlements(subscription?.plan_key ?? null);
}

export async function requireSeatAvailable(organizationId: string): Promise<void> {
  const entitlements = await getEntitlements(organizationId);
  if (entitlements.maxSeats === null) return;

  const sql = getAdminSql();
  const [row] = await sql<{ count: string }[]>`
    select count(*) as count from organization_members
    where organization_id = ${organizationId} and status = 'active'
  `;
  const activeSeats = Number(row?.count ?? 0);
  if (activeSeats >= entitlements.maxSeats) {
    throw new AppError(
      "conflict",
      `This organization has reached its ${entitlements.maxSeats}-seat plan limit. Upgrade the plan or remove an existing member before inviting another.`,
    );
  }
}

export function hasFeature(entitlements: PlanEntitlements, feature: string): boolean {
  return entitlements.features.has(feature);
}

export interface SeatUsage {
  used: number;
  /** null = unlimited. */
  limit: number | null;
}

export async function getSeatUsage(): Promise<SeatUsage> {
  const membership = await requirePermission("billing.manage");
  const entitlements = await getEntitlements(membership.organization.id);
  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [row] = await tx<{ count: string }[]>`
      select count(*) as count from organization_members
      where organization_id = ${membership.organization.id} and status = 'active'
    `;
    return { used: Number(row?.count ?? 0), limit: entitlements.maxSeats };
  });
}

/** Read-only usage visibility for the current calendar month — tracked via the existing ai_usage_events table (Phase 13), not a new counter. Not hard-enforced yet, see billing-architecture.md's known gaps. */
export async function getAiUsageForCurrentPeriod(): Promise<number> {
  const membership = await requirePermission("billing.manage");
  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [row] = await tx<{ count: string }[]>`
      select count(*) as count from ai_usage_events
      where organization_id = ${membership.organization.id}
        and created_at >= date_trunc('month', now())
    `;
    return Number(row?.count ?? 0);
  });
}

async function getOrCreateStripeCustomerId(
  membership: Awaited<ReturnType<typeof getCurrentMembership>>,
): Promise<string> {
  if (!isBillingConfigured()) {
    throw new AppError("unavailable", "Billing is not configured in this environment.");
  }
  if (membership.organization.stripe_customer_id) return membership.organization.stripe_customer_id;

  const customer = await getBillingProvider().createCustomer({
    organizationId: membership.organization.id,
    email: membership.profile.email,
    name: membership.organization.name,
  });

  const sql = getAdminSql();
  await sql`update organizations set stripe_customer_id = ${customer.customerId} where id = ${membership.organization.id}`;
  return customer.customerId;
}

export async function createCheckoutSessionUrl(
  planKey: PlanKey,
  successUrl: string,
  cancelUrl: string,
): Promise<string> {
  const membership = await requirePermission("billing.manage");
  const priceId = getStripePriceId(planKey);
  if (!priceId) {
    throw new AppError(
      "conflict",
      `No Stripe price is configured for the "${planKey}" plan (set STRIPE_PRICE_ID_${planKey.toUpperCase()}).`,
    );
  }

  const customerId = await getOrCreateStripeCustomerId(membership);
  const session = await getBillingProvider().createCheckoutSession({
    customerId,
    priceId,
    successUrl,
    cancelUrl,
  });
  return session.url;
}

export async function createBillingPortalUrl(returnUrl: string): Promise<string> {
  const membership = await requirePermission("billing.manage");
  const customerId = await getOrCreateStripeCustomerId(membership);
  const session = await getBillingProvider().createBillingPortalSession({ customerId, returnUrl });
  return session.url;
}

export async function cancelCurrentSubscription(atPeriodEnd: boolean): Promise<void> {
  const membership = await requirePermission("billing.manage");
  if (!isBillingConfigured()) {
    throw new AppError("unavailable", "Billing is not configured in this environment.");
  }
  const subscription = await getCurrentSubscription();
  if (!subscription) throw new AppError("not_found", "No active subscription to cancel.");

  await getBillingProvider().cancelSubscription({
    subscriptionId: subscription.stripe_subscription_id,
    atPeriodEnd,
  });

  await withTenantContext(toTenantContext(membership), (tx) =>
    recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.SubscriptionCancellationRequested,
      resourceType: AuditResourceType.Subscription,
      resourceId: subscription.id,
      source: "app",
      metadata: { atPeriodEnd },
    }),
  );
}
