import "server-only";
import type postgres from "postgres";
import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { enqueueJob } from "@/lib/jobs/enqueue";
import type {
  NotificationPreferenceRow,
  NotificationRow,
  NotificationType,
} from "@/lib/db/database.types";

/**
 * In-app notification feed, delivery scheduling, and preferences —
 * see docs/architecture/notifications.md. `createNotification()` is
 * the one entry point every trigger (workflow-engine.ts's task
 * assignment, approval-resolution.ts's approval request,
 * escalation.ts's reminder/breach, exceptions.ts's owner assignment)
 * calls, from within its own already-open transaction — same "trusted
 * caller inside an already-authorized transaction" posture as
 * recordAuditEvent()/enqueueJob().
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

export interface CreateNotificationInput {
  organizationId: string;
  departmentId?: string | null;
  recipientMemberId: string;
  notificationType: NotificationType;
  title: string;
  body: string;
  resourceType?: string | null;
  resourceId?: string | null;
}

async function resolveEmailEnabled(
  tx: postgres.Sql | postgres.TransactionSql,
  organizationId: string,
  memberId: string,
  notificationType: NotificationType,
): Promise<boolean> {
  const [memberRow] = await tx<{ email_enabled: boolean }[]>`
    select email_enabled from notification_preferences
    where organization_id = ${organizationId} and member_id = ${memberId} and notification_type = ${notificationType}
  `;
  if (memberRow) return memberRow.email_enabled;

  const [orgDefaultRow] = await tx<{ email_enabled: boolean }[]>`
    select email_enabled from notification_preferences
    where organization_id = ${organizationId} and member_id is null and notification_type = ${notificationType}
  `;
  // No preference row at all for this type — the safe default is "on",
  // per this phase's "no silently-lost notifications" goal.
  return orgDefaultRow?.email_enabled ?? true;
}

/** Inserts the notification (always — in-app visibility is not preference-gated in this phase, only the email channel is) and, if email is enabled for this recipient/type, schedules a delivery via the background-job worker rather than sending synchronously. Takes `postgres.Sql | postgres.TransactionSql`, same as exceptions.ts's createSystemException(), since some callers (e.g. workflow-engine.ts's activateNode()) are typed against that wider union. */
export async function createNotification(
  tx: postgres.Sql | postgres.TransactionSql,
  input: CreateNotificationInput,
): Promise<NotificationRow> {
  const [notification] = await tx<NotificationRow[]>`
    insert into notifications (
      organization_id, department_id, recipient_member_id, notification_type, title, body,
      resource_type, resource_id
    ) values (
      ${input.organizationId}, ${input.departmentId ?? null}, ${input.recipientMemberId}, ${input.notificationType},
      ${input.title}, ${input.body}, ${input.resourceType ?? null}, ${input.resourceId ?? null}
    )
    returning *
  `;

  const emailEnabled = await resolveEmailEnabled(
    tx,
    input.organizationId,
    input.recipientMemberId,
    input.notificationType,
  );
  if (!emailEnabled) {
    await tx`
      insert into notification_deliveries (notification_id, organization_id, channel, status)
      values (${notification.id}, ${input.organizationId}, 'email', 'skipped_preference')
    `;
    return notification;
  }

  const [delivery] = await tx<{ id: string }[]>`
    insert into notification_deliveries (notification_id, organization_id, channel, status)
    values (${notification.id}, ${input.organizationId}, 'email', 'pending')
    returning id
  `;
  await enqueueJob(tx, input.organizationId, {
    jobType: "deliver-notification-email",
    payload: { deliveryId: delivery.id },
    idempotencyKey: `deliver-notification-email:${delivery.id}`,
  });

  return notification;
}

export interface ListNotificationsFilters {
  unreadOnly?: boolean;
}

export async function listMyNotifications(
  filters: ListNotificationsFilters = {},
): Promise<NotificationRow[]> {
  const membership = await getCurrentMembership();
  return withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<NotificationRow[]>`
      select * from notifications
      where organization_id = ${membership.organization.id} and recipient_member_id = ${membership.member.id}
        and (${filters.unreadOnly ?? false} = false or read_at is null)
      order by created_at desc
      limit 100
    `,
  );
}

export async function getUnreadNotificationCount(): Promise<number> {
  const membership = await getCurrentMembership();
  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [row] = await tx<{ count: string }[]>`
      select count(*) as count from notifications
      where organization_id = ${membership.organization.id} and recipient_member_id = ${membership.member.id}
        and read_at is null
    `;
    return Number(row?.count ?? 0);
  });
}

export async function markNotificationRead(notificationId: string): Promise<NotificationRow> {
  const membership = await getCurrentMembership();
  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [updated] = await tx<NotificationRow[]>`
      update notifications set read_at = coalesce(read_at, now())
      where id = ${notificationId} and organization_id = ${membership.organization.id}
        and recipient_member_id = ${membership.member.id}
      returning *
    `;
    if (!updated) throw new AppError("not_found", "Notification not found.");
    return updated;
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  const membership = await getCurrentMembership();
  await withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx`
      update notifications set read_at = now()
      where organization_id = ${membership.organization.id} and recipient_member_id = ${membership.member.id}
        and read_at is null
    `,
  );
}

/** A member's own email-notification preferences, one row per type they've configured plus the org defaults for any type they haven't. */
export async function getMyNotificationPreferences(): Promise<NotificationPreferenceRow[]> {
  const membership = await getCurrentMembership();
  return withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<NotificationPreferenceRow[]>`
      select * from notification_preferences
      where organization_id = ${membership.organization.id}
        and (member_id = ${membership.member.id} or member_id is null)
      order by notification_type asc, member_id asc nulls last
    `,
  );
}

export async function setMyNotificationPreference(
  notificationType: NotificationType,
  emailEnabled: boolean,
): Promise<NotificationPreferenceRow> {
  const membership = await getCurrentMembership();
  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [preference] = await tx<NotificationPreferenceRow[]>`
      insert into notification_preferences (organization_id, member_id, notification_type, email_enabled)
      values (${membership.organization.id}, ${membership.member.id}, ${notificationType}, ${emailEnabled})
      on conflict (organization_id, member_id, notification_type) where member_id is not null
      do update set email_enabled = ${emailEnabled}, updated_at = now()
      returning *
    `;
    return preference;
  });
}

export async function getOrgDefaultNotificationPreferences(): Promise<NotificationPreferenceRow[]> {
  const membership = await requirePermission("organization.settings");
  return withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx<NotificationPreferenceRow[]>`
      select * from notification_preferences
      where organization_id = ${membership.organization.id} and member_id is null
      order by notification_type asc
    `,
  );
}

export async function setOrgDefaultNotificationPreference(
  notificationType: NotificationType,
  emailEnabled: boolean,
): Promise<NotificationPreferenceRow> {
  const membership = await requirePermission("organization.settings");
  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [preference] = await tx<NotificationPreferenceRow[]>`
      insert into notification_preferences (organization_id, member_id, notification_type, email_enabled)
      values (${membership.organization.id}, null, ${notificationType}, ${emailEnabled})
      on conflict (organization_id, notification_type) where member_id is null
      do update set email_enabled = ${emailEnabled}, updated_at = now()
      returning *
    `;
    return preference;
  });
}
