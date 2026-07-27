import "server-only";
import { getAdminSql } from "@/lib/db/client-admin";
import { registerJobHandler } from "@/lib/jobs/registry";
import { isEmailConfigured } from "@/lib/notifications/availability";
import { getEmailProvider } from "@/lib/notifications/get-provider";
import { renderNotificationEmail } from "@/lib/notifications/templates";
import type { NotificationDeliveryRow, NotificationRow } from "@/lib/db/database.types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.processpilot.com";

/**
 * The Phase 16 background job — sends one notification_deliveries row's
 * email. Registered at module load per every other Phase 8-12 job
 * handler's established pattern; import this module (for its side
 * effect) from src/app/api/jobs/process/route.ts. Runs through the
 * admin client rather than withTenantContext(), same reasoning as
 * every other job handler: this is trusted system code acting on a
 * job the triggering transaction already committed.
 *
 * Idempotent ("check status before acting", same shape as
 * evidence.ts's expireEvidence/waivers.ts's expireWaiver): a delivery
 * already resolved to 'sent'/'skipped_*' is a no-op, so a re-run
 * caused by a retried/duplicated job claim can never double-send.
 *
 * When the environment has no real EMAIL_PROVIDER_API_KEY, the
 * delivery is marked 'skipped_not_configured' and the job still
 * *succeeds* (does not throw) — a static misconfiguration would
 * otherwise retry forever and eventually dead-letter every
 * notification in the environment, which is a worse outcome than
 * recording, once, that no email went out. A genuine provider-side
 * failure (network error, non-2xx response) does rethrow, so the
 * worker's own exponential-backoff/dead-letter handling
 * (src/lib/jobs/worker.ts) applies exactly as it does to every other
 * job type — this handler does not reimplement retry policy.
 */
registerJobHandler("deliver-notification-email", async ({ job }) => {
  const sql = getAdminSql();
  const { deliveryId } = job.payload as { deliveryId: string };

  const [delivery] = await sql<NotificationDeliveryRow[]>`
    select * from notification_deliveries where id = ${deliveryId} and organization_id = ${job.organization_id}
  `;
  // 'sent' and both 'skipped_*' statuses are final — a retried/duplicate
  // job claim on an already-resolved delivery is a no-op. 'failed' is
  // deliberately still retryable here (not treated as final) so the
  // worker's own backoff schedule (src/lib/jobs/worker.ts) can retry a
  // transient provider error up to the job's max_attempts.
  if (!delivery || delivery.status === "sent" || delivery.status.startsWith("skipped")) return;

  const [notification] = await sql<NotificationRow[]>`
    select * from notifications where id = ${delivery.notification_id}
  `;
  if (!notification) return;

  if (!isEmailConfigured()) {
    await sql`
      update notification_deliveries set
        status = 'skipped_not_configured', attempt_count = attempt_count + 1,
        error_message = 'EMAIL_PROVIDER_API_KEY is not configured in this environment.'
      where id = ${deliveryId}
    `;
    return;
  }

  const [recipient] = await sql<{ email: string }[]>`
    select p.email from organization_members om
    join profiles p on p.id = om.profile_id
    where om.id = ${notification.recipient_member_id}
  `;
  if (!recipient?.email) {
    await sql`
      update notification_deliveries set
        status = 'failed', attempt_count = attempt_count + 1,
        error_message = 'Recipient has no email on file.'
      where id = ${deliveryId}
    `;
    return;
  }

  const email = renderNotificationEmail(
    notification.notification_type,
    notification.title,
    notification.body,
    APP_URL,
  );

  try {
    const result = await getEmailProvider().send({
      to: recipient.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    await sql`
      update notification_deliveries set
        status = 'sent', attempt_count = attempt_count + 1, sent_at = now(),
        provider_message_id = ${result.providerMessageId}
      where id = ${deliveryId}
    `;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await sql`
      update notification_deliveries set
        status = 'failed', attempt_count = attempt_count + 1, error_message = ${message.slice(0, 2000)}
      where id = ${deliveryId}
    `;
    throw error;
  }
});
