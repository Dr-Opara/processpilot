import { NextResponse, type NextRequest } from "next/server";
import type postgres from "postgres";
import { getAdminSql } from "@/lib/db/client-admin";
import { isBillingConfigured } from "@/lib/billing/availability";
import { getBillingProvider } from "@/lib/billing/get-provider";
import { getStripePriceId, type PlanKey } from "@/lib/billing/plans";
import type { BillingSubscriptionSnapshot, BillingWebhookEvent } from "@/lib/billing/adapter";

/**
 * Verifies, acknowledges, and persists Stripe subscription-lifecycle
 * events into `subscriptions` — the one and only writer of that table
 * (see billing.ts's header comment and
 * docs/architecture/billing-architecture.md). Mirrors
 * src/app/api/webhooks/clerk/route.ts's idempotency shape exactly:
 * `stripe-signature`/event id inserted into billing_webhook_events
 * *before* any sync runs, guarded by a partial unique index on
 * (stripe_event_id) where status = 'processed', so a concurrent
 * duplicate delivery loses the race and is acknowledged as
 * already-processed without re-running sync logic.
 */
export async function POST(request: NextRequest) {
  if (!isBillingConfigured()) {
    console.error("Stripe webhook received but billing is not configured in this environment.");
    return NextResponse.json({ error: "Billing not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: BillingWebhookEvent;
  try {
    event = getBillingProvider().verifyAndParseWebhook(rawBody, signature);
  } catch (error) {
    console.error("Stripe webhook signature verification failed", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const sql = getAdminSql();

  try {
    const deduped = await sql.begin(async (tx) => {
      const [claimed] = await tx<{ id: string }[]>`
        insert into billing_webhook_events (stripe_event_id, event_type, status)
        values (${event.id}, ${event.type}, 'processed')
        on conflict (stripe_event_id) where status = 'processed' do nothing
        returning id
      `;

      if (!claimed) return true;

      const organizationId = await applyEvent(tx, event);

      await tx`
        update billing_webhook_events
        set organization_id = ${organizationId}, processed_at = now()
        where id = ${claimed.id}
      `;

      return false;
    });

    return NextResponse.json({ received: true, deduped });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Stripe webhook processing failed", {
      type: event.type,
      eventId: event.id,
      message,
    });

    await sql`
      insert into billing_webhook_events (stripe_event_id, event_type, status, error_message)
      values (${event.id}, ${event.type}, 'failed', ${message})
    `.catch((insertError: unknown) => {
      console.error("Failed to record billing webhook failure", insertError);
    });

    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

function resolvePlanKey(priceId: string): string {
  const plans: PlanKey[] = ["starter", "business", "enterprise"];
  return plans.find((plan) => getStripePriceId(plan) === priceId) ?? "starter";
}

async function upsertSubscription(
  tx: postgres.TransactionSql,
  organizationId: string,
  snapshot: BillingSubscriptionSnapshot,
): Promise<void> {
  await tx`
    insert into subscriptions (
      organization_id, stripe_subscription_id, stripe_price_id, plan_key, status,
      current_period_start, current_period_end, cancel_at_period_end, trial_end
    ) values (
      ${organizationId}, ${snapshot.subscriptionId}, ${snapshot.priceId}, ${resolvePlanKey(snapshot.priceId)},
      ${snapshot.status}, ${snapshot.currentPeriodStart}, ${snapshot.currentPeriodEnd},
      ${snapshot.cancelAtPeriodEnd}, ${snapshot.trialEnd}
    )
    on conflict (stripe_subscription_id) do update set
      stripe_price_id = excluded.stripe_price_id,
      plan_key = excluded.plan_key,
      status = excluded.status,
      current_period_start = excluded.current_period_start,
      current_period_end = excluded.current_period_end,
      cancel_at_period_end = excluded.cancel_at_period_end,
      trial_end = excluded.trial_end,
      updated_at = now()
  `;
}

async function applyEvent(
  tx: postgres.TransactionSql,
  event: BillingWebhookEvent,
): Promise<string | null> {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      if (!event.subscription) return null;
      const [org] = await tx<{ id: string }[]>`
        select id from organizations where stripe_customer_id = ${event.subscription.customerId}
      `;
      if (!org) {
        // A subscription for a customer we don't recognize — nothing to
        // sync against, but still acknowledged (200) rather than
        // treated as a processing failure, same posture as the Clerk
        // webhook's unhandled-event-type default.
        return null;
      }
      await upsertSubscription(tx, org.id, event.subscription);
      return org.id;
    }

    default:
      // Every other Stripe event type this app doesn't yet act on
      // (invoice.*, payment_intent.*, ...) is still acknowledged (200)
      // and logged in billing_webhook_events above — never a
      // processing error. See billing-architecture.md's known gaps.
      return null;
  }
}
