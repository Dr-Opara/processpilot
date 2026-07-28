import "server-only";
import { getAdminSql } from "@/lib/db/client-admin";
import { registerJobHandler } from "@/lib/jobs/registry";
import { decryptWebhookSecret } from "@/lib/services/webhooks";
import { signWebhookPayload } from "@/lib/webhooks/signing";
import type { WebhookDeliveryRow, WebhookSubscriptionRow } from "@/lib/db/database.types";

/**
 * The outbound-webhook delivery job — signs and POSTs one
 * webhook_deliveries row. Registered at module load per every other
 * job handler's established pattern; import this module (for its side
 * effect) from src/app/api/jobs/process/route.ts.
 *
 * Retry/backoff/dead-lettering is entirely the background-job worker's
 * job (src/lib/jobs/worker.ts) — this handler rethrows on any
 * delivery failure so the worker's own exponential backoff applies,
 * exactly like every other job type. It only additionally marks the
 * *delivery* row 'dead_letter' (rather than the retryable 'failed')
 * when this is the job's last allowed attempt, so the admin UI's
 * delivery log reflects "no further retries will happen" accurately
 * without this handler reimplementing the worker's own attempt-count
 * policy.
 */
registerJobHandler("deliver-webhook", async ({ job }) => {
  const sql = getAdminSql();
  const { deliveryId } = job.payload as { deliveryId: string };

  const [delivery] = await sql<WebhookDeliveryRow[]>`
    select * from webhook_deliveries where id = ${deliveryId} and organization_id = ${job.organization_id}
  `;
  // 'delivered' and 'dead_letter' are final — a retried/duplicate job
  // claim on an already-resolved delivery is a no-op. 'pending' and
  // 'failed' are both still eligible to (re)send.
  if (!delivery || delivery.status === "delivered" || delivery.status === "dead_letter") return;

  const [subscription] = await sql<WebhookSubscriptionRow[]>`
    select * from webhook_subscriptions where id = ${delivery.subscription_id}
  `;
  if (!subscription || subscription.status !== "active") {
    await sql`
      update webhook_deliveries set
        status = 'dead_letter', attempt_count = attempt_count + 1, last_attempt_at = now(),
        last_error = 'Subscription is disabled or no longer exists.'
      where id = ${deliveryId}
    `;
    return;
  }

  const secret = decryptWebhookSecret(subscription.encrypted_secret);
  const body = JSON.stringify({ event: delivery.event_type, data: delivery.payload });
  const signature = signWebhookPayload(secret, body);
  const isFinalAttempt = job.attempts >= job.max_attempts;

  try {
    const response = await fetch(subscription.target_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-ProcessPilot-Event": delivery.event_type,
        "X-ProcessPilot-Signature": signature,
      },
      body,
    });

    if (response.ok) {
      await sql`
        update webhook_deliveries set
          status = 'delivered', attempt_count = attempt_count + 1, last_attempt_at = now(),
          last_response_status = ${response.status}, last_error = null
        where id = ${deliveryId}
      `;
      return;
    }

    await sql`
      update webhook_deliveries set
        status = ${isFinalAttempt ? "dead_letter" : "failed"}, attempt_count = attempt_count + 1,
        last_attempt_at = now(), last_response_status = ${response.status},
        last_error = ${`Endpoint responded ${response.status}`}
      where id = ${deliveryId}
    `;
    throw new Error(`Webhook endpoint responded ${response.status}`);
  } catch (error) {
    if (!(error instanceof Error && error.message.startsWith("Webhook endpoint responded"))) {
      const message = error instanceof Error ? error.message : String(error);
      await sql`
        update webhook_deliveries set
          status = ${isFinalAttempt ? "dead_letter" : "failed"}, attempt_count = attempt_count + 1,
          last_attempt_at = now(), last_error = ${message.slice(0, 2000)}
        where id = ${deliveryId}
      `;
    }
    throw error;
  }
});
