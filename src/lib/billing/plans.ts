/**
 * ⚠️ UNVALIDATED PRICING — working hypotheses only, transcribed from
 * product/pricing-hypotheses.md, which is explicitly "hypotheses, not
 * committed pricing." Tier names, seat limits, AI-usage units, and
 * feature inclusions below are all placeholders for wiring the
 * entitlement *mechanism* together — none of this may be surfaced as a
 * real price anywhere customer-facing (marketing site, checkout,
 * billing portal, invoices) until product/pricing-hypotheses.md's open
 * questions are resolved and pricing is explicitly promoted out of
 * that document. See docs/architecture/billing-architecture.md's
 * "Known gaps and pending decisions" for what remains unresolved and
 * how to replace this file once real pricing is committed.
 *
 * Stripe price ids are read from environment variables (never
 * hardcoded) so a real Stripe product/price catalog can be wired in
 * without a code change — see environment-variables.md.
 */
export type PlanKey = "starter" | "business" | "enterprise";

/** The plan an organization is treated as having when it has no active Stripe subscription at all — the lowest hypothesized tier, not "no access." */
export const DEFAULT_PLAN_KEY: PlanKey = "starter";

export interface PlanEntitlements {
  label: string;
  /** null = unlimited. */
  maxSeats: number | null;
  /** Hypothesized AI-copilot request allowance per calendar month; null = unlimited. Tracked via ai_usage_events, not yet hard-enforced — see billing.ts's getAiUsageForCurrentPeriod(). */
  aiRequestsPerMonth: number | null;
  features: ReadonlySet<string>;
}

export const PLAN_ENTITLEMENTS: Record<PlanKey, PlanEntitlements> = {
  starter: {
    label: "Starter (hypothesis)",
    maxSeats: 10,
    aiRequestsPerMonth: 0,
    features: new Set([]),
  },
  business: {
    label: "Business (hypothesis)",
    maxSeats: 100,
    aiRequestsPerMonth: 500,
    features: new Set(["training", "analytics", "approvals"]),
  },
  enterprise: {
    label: "Enterprise (hypothesis)",
    maxSeats: null,
    aiRequestsPerMonth: null,
    features: new Set(["training", "analytics", "approvals", "audit_export", "ai_copilot", "sso"]),
  },
} as const;

/** Maps a hypothesis plan key to its configured Stripe price id — undefined until STRIPE_PRICE_ID_* is set for that plan (see environment-variables.md), which is expected in this environment (no committed pricing, no real Stripe catalog yet). */
export function getStripePriceId(planKey: PlanKey): string | undefined {
  const envKey = `STRIPE_PRICE_ID_${planKey.toUpperCase()}`;
  return process.env[envKey];
}

export function resolveEntitlements(planKey: string | null): PlanEntitlements {
  if (planKey && planKey in PLAN_ENTITLEMENTS) return PLAN_ENTITLEMENTS[planKey as PlanKey];
  return PLAN_ENTITLEMENTS[DEFAULT_PLAN_KEY];
}
