import "server-only";
import Stripe from "stripe";
import { getStripeSecretKey, getStripeWebhookSecret } from "@/lib/billing/availability";
import type {
  BillingCustomer,
  BillingCustomerInput,
  BillingPortalSession,
  BillingPortalSessionInput,
  BillingProvider,
  BillingSubscriptionSnapshot,
  BillingWebhookEvent,
  CancelSubscriptionInput,
  CheckoutSession,
  CheckoutSessionInput,
} from "@/lib/billing/adapter";

/**
 * The initial concrete BillingProvider, per ADR-0007. Constructs the
 * client lazily (not at module load) so importing this module never
 * throws in an environment with no configured key — only calling a
 * method does, and every caller already checks isBillingConfigured()
 * first, same defensive-backstop reasoning as AnthropicProvider's
 * getClient().
 */
function toSnapshot(subscription: Stripe.Subscription): BillingSubscriptionSnapshot {
  const item = subscription.items.data[0];
  return {
    subscriptionId: subscription.id,
    customerId:
      typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
    priceId: item?.price.id ?? "",
    status: subscription.status,
    currentPeriodStart: item?.current_period_start
      ? new Date(item.current_period_start * 1000).toISOString()
      : null,
    currentPeriodEnd: item?.current_period_end
      ? new Date(item.current_period_end * 1000).toISOString()
      : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
  };
}

export class StripeProvider implements BillingProvider {
  readonly name = "stripe";
  private client: Stripe | null = null;

  private getClient(): Stripe {
    if (!this.client) {
      this.client = new Stripe(getStripeSecretKey());
    }
    return this.client;
  }

  async createCustomer(input: BillingCustomerInput): Promise<BillingCustomer> {
    const customer = await this.getClient().customers.create({
      email: input.email,
      name: input.name,
      metadata: { organizationId: input.organizationId },
    });
    return { customerId: customer.id };
  }

  async createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSession> {
    const session = await this.getClient().checkout.sessions.create({
      customer: input.customerId,
      mode: "subscription",
      line_items: [{ price: input.priceId, quantity: 1 }],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    });
    if (!session.url) throw new Error("Stripe did not return a checkout session URL.");
    return { url: session.url };
  }

  async createBillingPortalSession(
    input: BillingPortalSessionInput,
  ): Promise<BillingPortalSession> {
    const session = await this.getClient().billingPortal.sessions.create({
      customer: input.customerId,
      return_url: input.returnUrl,
    });
    return { url: session.url };
  }

  async cancelSubscription(input: CancelSubscriptionInput): Promise<void> {
    if (input.atPeriodEnd) {
      await this.getClient().subscriptions.update(input.subscriptionId, {
        cancel_at_period_end: true,
      });
    } else {
      await this.getClient().subscriptions.cancel(input.subscriptionId);
    }
  }

  verifyAndParseWebhook(rawBody: string, signature: string): BillingWebhookEvent {
    const event = this.getClient().webhooks.constructEvent(
      rawBody,
      signature,
      getStripeWebhookSecret(),
    );

    const object = event.data.object as { object: string };
    const subscription =
      object.object === "subscription"
        ? toSnapshot(event.data.object as Stripe.Subscription)
        : null;

    return { id: event.id, type: event.type, subscription };
  }
}
