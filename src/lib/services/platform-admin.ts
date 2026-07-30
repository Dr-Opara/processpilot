import "server-only";
import { z } from "zod";
import type postgres from "postgres";
import { getAdminSql } from "@/lib/db/client-admin";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { AppError } from "@/lib/errors";
import { getQueueHealth, getProviderConfigurationStatus } from "@/lib/observability/health";
import type {
  OrganizationRow,
  PlatformAdminAuditLogRow,
  PlatformSuspensionRow,
  PlatformSupportNoteRow,
} from "@/lib/db/database.types";

/**
 * Platform-admin service layer (Phase 27). Every function calls
 * requirePlatformAdmin() first and runs entirely through the admin
 * client (never withTenantContext()) — a platform-admin action is by
 * definition not scoped to one organization's session, the same
 * reasoning background-job handlers already use. Every write records a
 * `platform_admin_audit_log` row — separate from tenant `audit_events`,
 * since these actions cross the tenant boundary by design and must
 * remain visible regardless of what happens to any one organization.
 */

export async function recordPlatformAdminAction(
  sql: postgres.Sql | postgres.TransactionSql,
  input: {
    actorProfileId: string;
    action: string;
    targetOrganizationId?: string | null;
    targetProfileId?: string | null;
    reason?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await sql`
    insert into platform_admin_audit_log (
      actor_profile_id, action, target_organization_id, target_profile_id, reason, metadata
    ) values (
      ${input.actorProfileId}, ${input.action}, ${input.targetOrganizationId ?? null},
      ${input.targetProfileId ?? null}, ${input.reason ?? null},
      ${sql.json((input.metadata ?? {}) as unknown as postgres.JSONValue)}
    )
  `;
}

export interface PlatformOrganizationSummary {
  organization: OrganizationRow;
  memberCount: number;
  subscriptionStatus: string | null;
  isSuspended: boolean;
}

export async function listOrganizationsForPlatformAdmin(
  search?: string,
): Promise<PlatformOrganizationSummary[]> {
  await requirePlatformAdmin();
  const sql = getAdminSql();
  const pattern = search?.trim() ? `%${search.trim()}%` : null;

  const rows = await sql<
    (OrganizationRow & {
      member_count: string;
      subscription_status: string | null;
      is_suspended: boolean;
    })[]
  >`
    select
      o.*,
      count(distinct om.id) filter (where om.status = 'active') as member_count,
      s.status as subscription_status,
      exists (
        select 1 from platform_suspensions ps
        where ps.organization_id = o.id and ps.reactivated_at is null
      ) as is_suspended
    from organizations o
    left join organization_members om on om.organization_id = o.id
    left join subscriptions s on s.organization_id = o.id
    where ${pattern === null} or o.name ilike ${pattern} or o.slug ilike ${pattern}
    group by o.id, s.status
    order by o.created_at desc
    limit 200
  `;

  return rows.map(({ member_count, subscription_status, is_suspended, ...organization }) => ({
    organization,
    memberCount: Number(member_count),
    subscriptionStatus: subscription_status,
    isSuspended: is_suspended,
  }));
}

export interface PlatformOrganizationDetail {
  organization: OrganizationRow;
  memberCount: number;
  subscriptionStatus: string | null;
  activeSuspension: PlatformSuspensionRow | null;
  suspensionHistory: PlatformSuspensionRow[];
  supportNotes: PlatformSupportNoteRow[];
  recentAuditEvents: { action: string; created_at: string }[];
}

export async function getOrganizationDetailForPlatformAdmin(
  organizationId: string,
): Promise<PlatformOrganizationDetail> {
  await requirePlatformAdmin();
  const sql = getAdminSql();

  const [organization] = await sql<OrganizationRow[]>`
    select * from organizations where id = ${organizationId}
  `;
  if (!organization) throw new AppError("not_found", "Organization not found.");

  const [{ count: memberCount }] = await sql<{ count: string }[]>`
    select count(*) as count from organization_members
    where organization_id = ${organizationId} and status = 'active'
  `;
  const [subscription] = await sql<{ status: string }[]>`
    select status from subscriptions where organization_id = ${organizationId}
  `;
  const suspensionHistory = await sql<PlatformSuspensionRow[]>`
    select * from platform_suspensions where organization_id = ${organizationId}
    order by suspended_at desc
  `;
  const supportNotes = await sql<PlatformSupportNoteRow[]>`
    select * from platform_support_notes where organization_id = ${organizationId}
    order by created_at desc
  `;
  const recentAuditEvents = await sql<{ action: string; created_at: string }[]>`
    select action, created_at from audit_events where organization_id = ${organizationId}
    order by created_at desc
    limit 20
  `;

  return {
    organization,
    memberCount: Number(memberCount),
    subscriptionStatus: subscription?.status ?? null,
    activeSuspension: suspensionHistory.find((s) => !s.reactivated_at) ?? null,
    suspensionHistory,
    supportNotes,
    recentAuditEvents,
  };
}

export interface PlatformUserLookupResult {
  profileId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  memberships: { organizationId: string; organizationName: string; status: string }[];
}

export async function lookupUserByEmail(email: string): Promise<PlatformUserLookupResult | null> {
  await requirePlatformAdmin();
  const sql = getAdminSql();

  const [profile] = await sql<
    { id: string; email: string; first_name: string | null; last_name: string | null }[]
  >`
    select id, email, first_name, last_name from profiles where lower(email) = lower(${email})
  `;
  if (!profile) return null;

  const memberships = await sql<
    { organization_id: string; organization_name: string; status: string }[]
  >`
    select om.organization_id, o.name as organization_name, om.status
    from organization_members om
    join organizations o on o.id = om.organization_id
    where om.profile_id = ${profile.id}
  `;

  return {
    profileId: profile.id,
    email: profile.email,
    firstName: profile.first_name,
    lastName: profile.last_name,
    memberships: memberships.map((m) => ({
      organizationId: m.organization_id,
      organizationName: m.organization_name,
      status: m.status,
    })),
  };
}

export const suspendOrganizationInputSchema = z.object({
  organizationId: z.string().uuid(),
  reason: z.string().trim().min(1, "A reason is required for suspension."),
});
export type SuspendOrganizationInput = z.infer<typeof suspendOrganizationInputSchema>;

/**
 * Suspension reuses `organizations.archived_at` — `getCurrentOrganization()`
 * (src/lib/authz.ts) already filters `archived_at is null`, so setting it
 * immediately blocks every member's session from resolving that
 * organization, the same proven mechanism the organization's own
 * self-archival path would use, rather than a second, independently-
 * tested access-blocking check.
 */
export async function suspendOrganization(input: SuspendOrganizationInput): Promise<void> {
  const data = suspendOrganizationInputSchema.parse(input);
  const admin = await requirePlatformAdmin();
  const sql = getAdminSql();

  await sql.begin(async (tx) => {
    const [organization] = await tx<OrganizationRow[]>`
      select * from organizations where id = ${data.organizationId}
    `;
    if (!organization) throw new AppError("not_found", "Organization not found.");

    let suspension: PlatformSuspensionRow;
    try {
      [suspension] = await tx<PlatformSuspensionRow[]>`
        insert into platform_suspensions (organization_id, suspended_by, reason)
        values (${data.organizationId}, ${admin.id}, ${data.reason})
        returning *
      `;
    } catch {
      throw new AppError("conflict", "This organization already has an active suspension.");
    }

    await tx`update organizations set archived_at = ${suspension.suspended_at} where id = ${data.organizationId}`;

    await recordPlatformAdminAction(tx, {
      actorProfileId: admin.id,
      action: "organization.platform_suspended",
      targetOrganizationId: data.organizationId,
      reason: data.reason,
    });
  });
}

export async function reactivateOrganization(organizationId: string): Promise<void> {
  const admin = await requirePlatformAdmin();
  const sql = getAdminSql();

  await sql.begin(async (tx) => {
    const [suspension] = await tx<PlatformSuspensionRow[]>`
      update platform_suspensions set reactivated_by = ${admin.id}, reactivated_at = now()
      where organization_id = ${organizationId} and reactivated_at is null
      returning *
    `;
    if (!suspension) throw new AppError("not_found", "No active suspension found.");

    await tx`update organizations set archived_at = null where id = ${organizationId}`;

    await recordPlatformAdminAction(tx, {
      actorProfileId: admin.id,
      action: "organization.platform_reactivated",
      targetOrganizationId: organizationId,
    });
  });
}

export const addSupportNoteInputSchema = z.object({
  organizationId: z.string().uuid(),
  note: z.string().trim().min(1, "A note is required."),
});
export type AddSupportNoteInput = z.infer<typeof addSupportNoteInputSchema>;

export async function addSupportNote(input: AddSupportNoteInput): Promise<PlatformSupportNoteRow> {
  const data = addSupportNoteInputSchema.parse(input);
  const admin = await requirePlatformAdmin();
  const sql = getAdminSql();

  return sql.begin(async (tx) => {
    const [note] = await tx<PlatformSupportNoteRow[]>`
      insert into platform_support_notes (organization_id, author_profile_id, note)
      values (${data.organizationId}, ${admin.id}, ${data.note})
      returning *
    `;

    await recordPlatformAdminAction(tx, {
      actorProfileId: admin.id,
      action: "organization.support_note_added",
      targetOrganizationId: data.organizationId,
    });

    return note;
  });
}

export interface PlatformHealthOverview {
  organizationCount: number;
  activeSuspensionCount: number;
  queue: Awaited<ReturnType<typeof getQueueHealth>>;
  providers: ReturnType<typeof getProviderConfigurationStatus>;
  deploymentVersion: string;
}

export async function getPlatformHealthOverview(): Promise<PlatformHealthOverview> {
  await requirePlatformAdmin();
  const sql = getAdminSql();

  const [{ count: organizationCount }] = await sql<{ count: string }[]>`
    select count(*) as count from organizations where archived_at is null
  `;
  const [{ count: activeSuspensionCount }] = await sql<{ count: string }[]>`
    select count(*) as count from platform_suspensions where reactivated_at is null
  `;

  return {
    organizationCount: Number(organizationCount),
    activeSuspensionCount: Number(activeSuspensionCount),
    queue: await getQueueHealth(),
    providers: getProviderConfigurationStatus(),
    deploymentVersion: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
  };
}

export async function listPlatformAdminAuditLog(limit = 100): Promise<PlatformAdminAuditLogRow[]> {
  await requirePlatformAdmin();
  const sql = getAdminSql();
  const capped = Math.min(Math.max(limit, 1), 500);

  return sql<PlatformAdminAuditLogRow[]>`
    select * from platform_admin_audit_log order by created_at desc limit ${capped}
  `;
}
