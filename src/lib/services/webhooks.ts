import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import type postgres from "postgres";
import { requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { enqueueJob } from "@/lib/jobs/enqueue";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import { decryptSecret, encryptSecret, isEncryptionConfigured } from "@/lib/crypto/secret-box";
import { isAllowedWebhookUrl } from "@/lib/webhooks/ssrf-guard";
import type { WebhookDeliveryRow, WebhookSubscriptionRow } from "@/lib/db/database.types";

/**
 * Outbound webhook subscriptions and delivery history. Actual delivery
 * (HTTP POST, signing, retry/backoff, dead-lettering) is
 * src/lib/jobs/webhook-handlers.ts's job — this module owns
 * subscription CRUD, triggering a delivery, and replay.
 */

function toTenantContext(membership: {
  organization: { id: string };
  member: { id: string };
  profile: { clerk_user_id: string };
}) {
  return {
    organizationId: membership.organization.id,
    memberId: membership.member.id,
    clerkUserId: membership.profile.clerk_user_id,
  };
}

export const WEBHOOK_EVENT_TYPES = [
  "workflow.started",
  "workflow.completed",
  "workflow.failed",
  "exception.created",
  "exception.closed",
  "approval.decided",
] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export const createWebhookSubscriptionInputSchema = z.object({
  targetUrl: z.string().trim().url(),
  eventTypes: z.array(z.enum(WEBHOOK_EVENT_TYPES)).min(1, "Select at least one event type"),
});
export type CreateWebhookSubscriptionInput = z.infer<typeof createWebhookSubscriptionInputSchema>;

function generateSecret(): string {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}

export interface CreatedWebhookSubscription {
  row: WebhookSubscriptionRow;
  /** Shown once, at creation (and on rotation) — used to verify signed deliveries. Not recoverable afterward (the row only ever stores the encrypted form). */
  secret: string;
}

export async function createWebhookSubscription(
  input: CreateWebhookSubscriptionInput,
): Promise<CreatedWebhookSubscription> {
  const data = createWebhookSubscriptionInputSchema.parse(input);
  const urlCheck = isAllowedWebhookUrl(data.targetUrl);
  if (!urlCheck.allowed)
    throw new AppError("bad_request", urlCheck.reason ?? "This URL is not allowed.");
  if (!isEncryptionConfigured()) {
    throw new AppError(
      "unavailable",
      "Webhook secret storage is not configured in this environment.",
    );
  }

  const membership = await requirePermission("integration.manage");
  const secret = generateSecret();

  const row = await withTenantContext(toTenantContext(membership), async (tx) => {
    const [row] = await tx<WebhookSubscriptionRow[]>`
      insert into webhook_subscriptions (organization_id, target_url, event_types, encrypted_secret, created_by)
      values (${membership.organization.id}, ${data.targetUrl}, ${data.eventTypes}, ${encryptSecret(secret)}, ${membership.profile.id})
      returning *
    `;
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.WebhookSubscriptionCreated,
      resourceType: AuditResourceType.WebhookSubscription,
      resourceId: row.id,
      source: "app",
      metadata: { targetUrl: data.targetUrl, eventTypes: data.eventTypes },
    });
    return row;
  });

  return { row, secret };
}

export async function listWebhookSubscriptions(): Promise<WebhookSubscriptionRow[]> {
  const membership = await requirePermission("integration.manage");
  return withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<WebhookSubscriptionRow[]>`
      select * from webhook_subscriptions where organization_id = ${membership.organization.id} order by created_at desc
    `,
  );
}

export async function setWebhookSubscriptionStatus(
  subscriptionId: string,
  status: "active" | "disabled",
): Promise<WebhookSubscriptionRow> {
  const membership = await requirePermission("integration.manage");
  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [row] = await tx<WebhookSubscriptionRow[]>`
      update webhook_subscriptions set status = ${status}
      where id = ${subscriptionId} and organization_id = ${membership.organization.id}
      returning *
    `;
    if (!row) throw new AppError("not_found", "Webhook subscription not found.");
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.WebhookSubscriptionUpdated,
      resourceType: AuditResourceType.WebhookSubscription,
      resourceId: subscriptionId,
      source: "app",
      metadata: { status },
    });
    return row;
  });
}

export async function deleteWebhookSubscription(subscriptionId: string): Promise<void> {
  const membership = await requirePermission("integration.manage");
  await withTenantContext(toTenantContext(membership), async (tx) => {
    const [row] = await tx<WebhookSubscriptionRow[]>`
      delete from webhook_subscriptions
      where id = ${subscriptionId} and organization_id = ${membership.organization.id}
      returning *
    `;
    if (!row) throw new AppError("not_found", "Webhook subscription not found.");
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.WebhookSubscriptionDeleted,
      resourceType: AuditResourceType.WebhookSubscription,
      resourceId: subscriptionId,
      source: "app",
    });
  });
}

export async function listWebhookDeliveries(
  subscriptionId?: string,
  limit = 50,
): Promise<WebhookDeliveryRow[]> {
  const membership = await requirePermission("integration.manage");
  const capped = Math.min(Math.max(limit, 1), 200);
  return withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<WebhookDeliveryRow[]>`
      select * from webhook_deliveries
      where organization_id = ${membership.organization.id}
        and (${subscriptionId ?? null}::uuid is null or subscription_id = ${subscriptionId ?? null})
      order by created_at desc
      limit ${capped}
    `,
  );
}

export async function replayWebhookDelivery(deliveryId: string): Promise<void> {
  const membership = await requirePermission("integration.manage");
  await withTenantContext(toTenantContext(membership), async (tx) => {
    const [delivery] = await tx<WebhookDeliveryRow[]>`
      update webhook_deliveries set status = 'pending', attempt_count = 0
      where id = ${deliveryId} and organization_id = ${membership.organization.id}
      returning *
    `;
    if (!delivery) throw new AppError("not_found", "Webhook delivery not found.");

    await enqueueJob(tx, membership.organization.id, {
      jobType: "deliver-webhook",
      payload: { deliveryId },
      idempotencyKey: `deliver-webhook:${deliveryId}:replay:${Date.now()}`,
    });
    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.WebhookDeliveryReplayed,
      resourceType: AuditResourceType.WebhookDelivery,
      resourceId: deliveryId,
      source: "app",
    });
  });
}

/**
 * Called from within an already-open transaction by the domain code
 * that produces a given event type (one representative call site is
 * wired in this phase — workflow-engine.ts's workflow completion, see
 * docs/architecture/integration-architecture.md) — fans the event out
 * to every active subscription matching it, same "trusted caller
 * inside an already-authorized transaction" posture as
 * createNotification()/recordAuditEvent().
 */
export async function triggerWebhookEvent(
  tx: postgres.Sql | postgres.TransactionSql,
  organizationId: string,
  eventType: WebhookEventType,
  payload: Record<string, unknown>,
): Promise<void> {
  const subscriptions = await tx<Pick<WebhookSubscriptionRow, "id">[]>`
    select id from webhook_subscriptions
    where organization_id = ${organizationId} and status = 'active' and ${eventType} = any(event_types)
  `;

  for (const subscription of subscriptions) {
    const [delivery] = await tx<Pick<WebhookDeliveryRow, "id">[]>`
      insert into webhook_deliveries (subscription_id, organization_id, event_type, payload)
      values (${subscription.id}, ${organizationId}, ${eventType}, ${tx.json(payload as unknown as Parameters<typeof tx.json>[0])})
      returning id
    `;
    await enqueueJob(tx, organizationId, {
      jobType: "deliver-webhook",
      payload: { deliveryId: delivery.id },
      idempotencyKey: `deliver-webhook:${delivery.id}`,
    });
  }
}

/** Used only by the job handler to decrypt a subscription's signing secret right before sending — never returned to any page/action. */
export function decryptWebhookSecret(encrypted: string): string {
  return decryptSecret(encrypted);
}
