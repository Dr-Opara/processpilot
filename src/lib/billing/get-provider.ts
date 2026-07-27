import "server-only";
import { StripeProvider } from "@/lib/billing/providers/stripe-provider";
import type { BillingProvider } from "@/lib/billing/adapter";

let provider: BillingProvider | undefined;

/** The one place that names a concrete provider — every caller uses this, never `new StripeProvider()` directly, mirroring src/lib/ai/get-provider.ts and src/lib/notifications/get-provider.ts. */
export function getBillingProvider(): BillingProvider {
  if (!provider) provider = new StripeProvider();
  return provider;
}
