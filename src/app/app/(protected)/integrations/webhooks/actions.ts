"use server";

import { revalidatePath } from "next/cache";
import { runFormAction } from "@/lib/form-actions";
import {
  createWebhookSubscription,
  deleteWebhookSubscription,
  replayWebhookDelivery,
  setWebhookSubscriptionStatus,
  type WebhookEventType,
} from "@/lib/services/webhooks";

export async function createWebhookSubscriptionAction(formData: FormData): Promise<void> {
  await runFormAction("/app/integrations/webhooks", async () => {
    const eventTypes = formData.getAll("eventTypes").map(String) as WebhookEventType[];
    const created = await createWebhookSubscription({
      targetUrl: String(formData.get("targetUrl") ?? ""),
      eventTypes,
    });
    revalidatePath("/app/integrations/webhooks");
    return `/app/integrations/webhooks?newSecret=${encodeURIComponent(created.secret)}`;
  });
}

export async function toggleWebhookSubscriptionAction(
  subscriptionId: string,
  nextStatus: "active" | "disabled",
): Promise<void> {
  await runFormAction("/app/integrations/webhooks", async () => {
    await setWebhookSubscriptionStatus(subscriptionId, nextStatus);
    revalidatePath("/app/integrations/webhooks");
    return "/app/integrations/webhooks";
  });
}

export async function deleteWebhookSubscriptionAction(subscriptionId: string): Promise<void> {
  await runFormAction("/app/integrations/webhooks", async () => {
    await deleteWebhookSubscription(subscriptionId);
    revalidatePath("/app/integrations/webhooks");
    return "/app/integrations/webhooks";
  });
}

export async function replayWebhookDeliveryAction(deliveryId: string): Promise<void> {
  await runFormAction("/app/integrations/webhooks", async () => {
    await replayWebhookDelivery(deliveryId);
    revalidatePath("/app/integrations/webhooks");
    return "/app/integrations/webhooks";
  });
}
