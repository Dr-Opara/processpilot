"use server";

import { runFormAction } from "@/lib/form-actions";
import {
  cancelCurrentSubscription,
  createBillingPortalUrl,
  createCheckoutSessionUrl,
} from "@/lib/services/billing";
import type { PlanKey } from "@/lib/billing/plans";

function absoluteUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.processpilot.com";
  return `${base}${path}`;
}

export async function checkoutAction(formData: FormData): Promise<void> {
  await runFormAction("/app/billing", async () => {
    const planKey = String(formData.get("planKey")) as PlanKey;
    return createCheckoutSessionUrl(
      planKey,
      absoluteUrl("/app/billing?checkout=success"),
      absoluteUrl("/app/billing?checkout=canceled"),
    );
  });
}

export async function portalAction(): Promise<void> {
  await runFormAction("/app/billing", () => createBillingPortalUrl(absoluteUrl("/app/billing")));
}

export async function cancelSubscriptionAction(formData: FormData): Promise<void> {
  await runFormAction("/app/billing", async () => {
    const atPeriodEnd = formData.get("atPeriodEnd") === "on";
    await cancelCurrentSubscription(atPeriodEnd);
    return "/app/billing";
  });
}
