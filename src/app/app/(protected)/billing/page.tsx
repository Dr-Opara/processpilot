import { Heading, Text } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { isBillingConfigured } from "@/lib/billing/availability";
import { PLAN_ENTITLEMENTS, type PlanKey } from "@/lib/billing/plans";
import {
  getAiUsageForCurrentPeriod,
  getCurrentSubscription,
  getSeatUsage,
} from "@/lib/services/billing";
import { AppError } from "@/lib/errors";
import type { SubscriptionStatus } from "@/lib/db/database.types";
import { cancelSubscriptionAction, checkoutAction, portalAction } from "./actions";

function statusBadgeStatus(
  status: SubscriptionStatus,
): "success" | "warning" | "danger" | "neutral" {
  if (status === "active" || status === "trialing") return "success";
  if (status === "past_due" || status === "unpaid") return "danger";
  return "warning";
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; error?: string }>;
}) {
  const { checkout, error } = await searchParams;
  const configured = isBillingConfigured();

  let loadError: string | null = null;
  let subscription: Awaited<ReturnType<typeof getCurrentSubscription>> = null;
  let seatUsage: Awaited<ReturnType<typeof getSeatUsage>> | null = null;
  let aiUsage: number | null = null;

  try {
    [subscription, seatUsage, aiUsage] = await Promise.all([
      getCurrentSubscription(),
      getSeatUsage(),
      getAiUsageForCurrentPeriod().catch(() => null),
    ]);
  } catch (err) {
    loadError = err instanceof AppError ? err.message : "Could not load billing information.";
  }

  return (
    <Stack className="mx-auto max-w-3xl gap-8">
      <Stack className="gap-1">
        <Heading as="h1">Billing</Heading>
        <Text className="text-muted">Subscription, seats, and usage for this organization.</Text>
      </Stack>

      <Alert
        title="Pricing shown here is an unvalidated working hypothesis"
        description="Plan names, seat limits, and inclusions come from product/pricing-hypotheses.md, which is explicitly not committed pricing. None of this is real, customer-facing pricing yet — see docs/architecture/billing-architecture.md."
      />

      {!configured && (
        <Alert
          title="Billing is not configured"
          description="No real Stripe credentials exist in this environment (STRIPE_SECRET_KEY/STRIPE_WEBHOOK_SECRET). Subscription actions are unavailable until they're set — see docs/development/environment-variables.md."
        />
      )}

      {checkout === "success" && (
        <Alert
          title="Checkout complete"
          description="Stripe will confirm the subscription via webhook shortly — refresh in a moment if it doesn't appear yet."
        />
      )}
      {(error || loadError) && (
        <Alert title="Something went wrong" description={error ?? loadError ?? ""} />
      )}

      {!loadError && (
        <Stack className="gap-3 rounded-md border border-border p-4">
          <Heading as="h2">Current plan</Heading>
          {subscription ? (
            <Stack className="gap-2">
              <Cluster className="items-center gap-2">
                <Text className="font-semibold">
                  {PLAN_ENTITLEMENTS[subscription.plan_key as PlanKey]?.label ??
                    subscription.plan_key}
                </Text>
                <StatusBadge status={statusBadgeStatus(subscription.status)}>
                  {subscription.status.replace(/_/g, " ")}
                </StatusBadge>
              </Cluster>
              {subscription.current_period_end && (
                <Text className="text-sm text-muted">
                  {subscription.cancel_at_period_end ? "Ends" : "Renews"}{" "}
                  {new Date(subscription.current_period_end).toLocaleDateString()}
                </Text>
              )}
              <Cluster className="gap-2">
                <form action={portalAction}>
                  <Button type="submit" variant="secondary" disabled={!configured}>
                    Manage billing
                  </Button>
                </form>
                {!subscription.cancel_at_period_end && (
                  <form action={cancelSubscriptionAction}>
                    <input type="hidden" name="atPeriodEnd" value="on" />
                    <Button type="submit" variant="quiet" disabled={!configured}>
                      Cancel at period end
                    </Button>
                  </form>
                )}
              </Cluster>
            </Stack>
          ) : (
            <Stack className="gap-3">
              <Text className="text-sm text-muted">
                No active subscription — this organization defaults to the Starter (hypothesis)
                plan&apos;s limits.
              </Text>
              <Cluster className="flex-wrap gap-3">
                {(Object.keys(PLAN_ENTITLEMENTS) as PlanKey[])
                  .filter((key) => key !== "starter")
                  .map((key) => (
                    <form key={key} action={checkoutAction}>
                      <input type="hidden" name="planKey" value={key} />
                      <Button type="submit" variant="secondary" disabled={!configured}>
                        Subscribe: {PLAN_ENTITLEMENTS[key].label}
                      </Button>
                    </form>
                  ))}
              </Cluster>
            </Stack>
          )}
        </Stack>
      )}

      {!loadError && seatUsage && (
        <Stack className="gap-3 rounded-md border border-border p-4">
          <Heading as="h2">Usage</Heading>
          <Cluster className="flex-wrap gap-6">
            <Stack className="gap-0">
              <Text className="text-xs text-muted">Seats</Text>
              <Text className="text-xl font-semibold">
                {seatUsage.used}
                {seatUsage.limit !== null ? ` / ${seatUsage.limit}` : " (unlimited)"}
              </Text>
            </Stack>
            {aiUsage !== null && (
              <Stack className="gap-0">
                <Text className="text-xs text-muted">AI requests this month</Text>
                <Text className="text-xl font-semibold">{aiUsage}</Text>
              </Stack>
            )}
          </Cluster>
        </Stack>
      )}
    </Stack>
  );
}
