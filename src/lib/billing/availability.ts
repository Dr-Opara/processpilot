import "server-only";

/**
 * Whether the billing adapter has real, usable credentials — same
 * "distinguish unconfigured from a genuine failure" and literal-
 * placeholder-value check as src/lib/ai/availability.ts's
 * isAiConfigured() and src/lib/notifications/availability.ts's
 * isEmailConfigured(), applied to STRIPE_SECRET_KEY/
 * STRIPE_WEBHOOK_SECRET. Every billing.ts function checks this before
 * reaching the provider, and the webhook route checks it before even
 * attempting signature verification, so an unconfigured environment
 * fails safely with a clear "billing is not configured" administrative
 * state rather than a fabricated success or an unhandled exception.
 */
const PLACEHOLDER_MARKERS = ["replace_me", "replace-me", "changeme", "your-key-here", "xxxxxxxx"];

export function isBillingConfigured(): boolean {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !secretKey.trim() || !webhookSecret || !webhookSecret.trim()) return false;
  const lowered = secretKey.toLowerCase();
  return !PLACEHOLDER_MARKERS.some((marker) => lowered.includes(marker));
}

export function getStripeSecretKey(): string {
  if (!isBillingConfigured()) {
    throw new Error(
      "STRIPE_SECRET_KEY is not configured — call isBillingConfigured() before invoking the billing adapter.",
    );
  }
  return process.env.STRIPE_SECRET_KEY as string;
}

export function getStripeWebhookSecret(): string {
  if (!isBillingConfigured()) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET is not configured — call isBillingConfigured() before invoking the billing adapter.",
    );
  }
  return process.env.STRIPE_WEBHOOK_SECRET as string;
}
