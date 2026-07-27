import "server-only";

/**
 * Provider-neutral billing adapter, mirroring src/lib/ai/adapter.ts and
 * src/lib/notifications/adapter.ts's pattern (see ADR-0007/ADR-0008).
 * Every billing action goes through `getBillingProvider()`'s methods —
 * never the Stripe SDK called directly from a service, webhook route,
 * or job handler — so the vendor could change without a business-logic
 * rewrite. Types here are ProcessPilot's own normalized shapes, not
 * re-exports of `Stripe.*` types, so a provider swap can't leak a
 * vendor-specific shape into calling code.
 */
export interface BillingCustomerInput {
  organizationId: string;
  email: string;
  name: string;
}

export interface BillingCustomer {
  customerId: string;
}

export interface CheckoutSessionInput {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSession {
  url: string;
}

export interface BillingPortalSessionInput {
  customerId: string;
  returnUrl: string;
}

export interface BillingPortalSession {
  url: string;
}

export interface CancelSubscriptionInput {
  subscriptionId: string;
  /** true = let the current period run out; false = cancel immediately. */
  atPeriodEnd: boolean;
}

/** Normalized subset of a Stripe subscription object's fields — exactly what subscriptions.ts's webhook sync needs, nothing vendor-shaped. */
export interface BillingSubscriptionSnapshot {
  subscriptionId: string;
  customerId: string;
  priceId: string;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEnd: string | null;
}

/** A verified, normalized webhook event — the provider has already checked the signature by the time this is returned. */
export interface BillingWebhookEvent {
  id: string;
  type: string;
  /** Present for subscription lifecycle event types; null for event types the caller doesn't need to parse further (still safely acknowledged). */
  subscription: BillingSubscriptionSnapshot | null;
}

export interface BillingProvider {
  readonly name: string;
  createCustomer(input: BillingCustomerInput): Promise<BillingCustomer>;
  createCheckoutSession(input: CheckoutSessionInput): Promise<CheckoutSession>;
  createBillingPortalSession(input: BillingPortalSessionInput): Promise<BillingPortalSession>;
  cancelSubscription(input: CancelSubscriptionInput): Promise<void>;
  /** Throws if the signature doesn't verify — callers must not act on an unverified payload. */
  verifyAndParseWebhook(rawBody: string, signature: string): BillingWebhookEvent;
}
