import "server-only";
import type postgres from "postgres";
import { recordAuditEvent } from "./audit";
import { AuditAction, AuditResourceType } from "./audit-actions";
import type {
  OrganizationInvitationRow,
  OrganizationMemberRow,
  OrganizationRow,
  ProfileRow,
} from "./database.types";

/**
 * Maps Clerk webhook payloads onto ProcessPilot's own profiles/
 * organizations/organization_members tables. Every function here is
 * idempotent by construction (ON CONFLICT upsert on the relevant Clerk
 * id) — Clerk's Standard Webhooks delivery is at-least-once, and
 * src/app/api/webhooks/clerk/route.ts's webhook_events.clerk_event_id
 * unique constraint is the primary dedupe guard, but these functions
 * don't rely on that alone; replaying the same event twice produces the
 * same end state, not duplicate rows or errors.
 *
 * Always called with the admin (service-role) sql client — webhook
 * requests are authenticated by Standard Webhooks signature, not a Clerk
 * session, so there is no tenant context to open a withTenantContext()
 * transaction with. Each function still writes its own audit_events row
 * inside the same transaction as its data change.
 */

interface ClerkEmailAddress {
  id: string;
  email_address: string;
}

export interface ClerkUserPayload {
  id: string;
  email_addresses: ClerkEmailAddress[];
  primary_email_address_id: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url?: string;
}

/**
 * No audit event is recorded here — user.created/updated isn't in the
 * audited action list (docs/architecture/data-ownership.md /
 * product/permissions-matrix.md's audited actions are org/membership/
 * role/structural, not raw profile syncs).
 */
export async function syncUserUpserted(
  sql: postgres.Sql | postgres.TransactionSql,
  data: ClerkUserPayload,
): Promise<ProfileRow> {
  const email =
    data.email_addresses.find((address) => address.id === data.primary_email_address_id)
      ?.email_address ?? data.email_addresses[0]?.email_address;

  if (!email) {
    throw new Error(`Clerk user ${data.id} has no email address to sync`);
  }

  const [profile] = await sql<ProfileRow[]>`
    insert into profiles (clerk_user_id, email, first_name, last_name, avatar_url)
    values (${data.id}, ${email}, ${data.first_name}, ${data.last_name}, ${data.image_url ?? null})
    on conflict (clerk_user_id) do update set
      email = excluded.email,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      avatar_url = excluded.avatar_url,
      updated_at = now(),
      deleted_at = null
    returning *
  `;

  return profile;
}

export async function syncUserDeleted(
  sql: postgres.Sql | postgres.TransactionSql,
  clerkUserId: string,
): Promise<void> {
  await sql`
    update profiles
    set deleted_at = now(), updated_at = now()
    where clerk_user_id = ${clerkUserId} and deleted_at is null
  `;
}

export interface ClerkOrganizationPayload {
  id: string;
  name: string;
  slug: string;
  created_by?: string;
}

export async function syncOrganizationUpserted(
  sql: postgres.Sql | postgres.TransactionSql,
  data: ClerkOrganizationPayload,
  correlationId: string,
): Promise<OrganizationRow> {
  let createdByProfileId: string | null = null;
  if (data.created_by) {
    const [creator] = await sql<Pick<ProfileRow, "id">[]>`
      select id from profiles where clerk_user_id = ${data.created_by}
    `;
    createdByProfileId = creator?.id ?? null;
  }

  const [organization] = await sql<OrganizationRow[]>`
    insert into organizations (clerk_org_id, name, slug, created_by)
    values (${data.id}, ${data.name}, ${data.slug}, ${createdByProfileId})
    on conflict (clerk_org_id) do update set
      name = excluded.name,
      slug = excluded.slug,
      updated_at = now(),
      archived_at = null
    returning *
  `;

  await sql`
    insert into organization_settings (organization_id, created_by)
    values (${organization.id}, ${createdByProfileId})
    on conflict (organization_id) do nothing
  `;

  await recordAuditEvent(sql, {
    organizationId: organization.id,
    actorProfileId: createdByProfileId,
    action: "organization.synced",
    resourceType: "organization",
    resourceId: organization.id,
    correlationId,
    source: "webhook",
    metadata: { clerkOrgId: data.id },
  });

  return organization;
}

/**
 * Clerk's organization.deleted event maps to archiving, never a hard
 * delete — account closure is a deliberate, admin-gated operation per
 * docs/architecture/data-ownership.md, not implicitly triggered by
 * whatever action fired this webhook; the row (and everything that
 * references it) stays intact for historical/audit purposes.
 */
export async function syncOrganizationArchived(
  sql: postgres.Sql | postgres.TransactionSql,
  clerkOrgId: string,
  correlationId: string,
): Promise<void> {
  const [organization] = await sql<Pick<OrganizationRow, "id">[]>`
    update organizations
    set archived_at = now(), updated_at = now()
    where clerk_org_id = ${clerkOrgId} and archived_at is null
    returning id
  `;

  if (!organization) return;

  await recordAuditEvent(sql, {
    organizationId: organization.id,
    action: "organization.archived",
    resourceType: "organization",
    resourceId: organization.id,
    correlationId,
    source: "webhook",
  });
}

export interface ClerkMembershipPayload {
  id: string;
  role: string;
  organization: { id: string };
  public_user_data: { user_id: string };
}

export async function syncMembershipUpserted(
  sql: postgres.Sql | postgres.TransactionSql,
  data: ClerkMembershipPayload,
  correlationId: string,
): Promise<OrganizationMemberRow> {
  const [profile] = await sql<Pick<ProfileRow, "id">[]>`
    select id from profiles where clerk_user_id = ${data.public_user_data.user_id}
  `;
  const [organization] = await sql<Pick<OrganizationRow, "id">[]>`
    select id from organizations where clerk_org_id = ${data.organization.id}
  `;

  if (!profile || !organization) {
    throw new Error(
      `Cannot sync membership ${data.id}: profile or organization not yet synced ` +
        `(profile=${data.public_user_data.user_id}, org=${data.organization.id})`,
    );
  }

  const [member] = await sql<OrganizationMemberRow[]>`
    insert into organization_members (organization_id, profile_id, clerk_membership_id, clerk_role, status)
    values (${organization.id}, ${profile.id}, ${data.id}, ${data.role}, 'active')
    on conflict (clerk_membership_id) do update set
      clerk_role = excluded.clerk_role,
      status = 'active',
      updated_at = now()
    returning *
  `;

  await recordAuditEvent(sql, {
    organizationId: organization.id,
    actorProfileId: profile.id,
    action: "membership.synced",
    resourceType: "organization_member",
    resourceId: member.id,
    correlationId,
    source: "webhook",
    metadata: { clerkMembershipId: data.id, clerkRole: data.role },
  });

  await applyPendingInvitation(sql, organization.id, member.id, correlationId);

  return member;
}

/**
 * Phase 5: a Clerk organization-invitation acceptance surfaces here as an
 * ordinary organizationMembership.created event — Clerk doesn't tell us
 * "this join came from invitation X," so this matches by (organization,
 * lower(email)) against the one 'pending' organization_invitations row
 * that should exist (the unique partial index on
 * organization_invitations enforces at most one pending row per email).
 * Runs with the admin client (webhook context has no tenant claims), so
 * the RLS self-escalation check on member_role_assignments doesn't apply
 * here — that's fine, the invitation's role_id was already authorized
 * against the inviter's own permissions at creation time
 * (src/lib/services/invitations.ts's assertRoleAssignable), not something
 * that needs re-checking at acceptance.
 */
async function applyPendingInvitation(
  sql: postgres.Sql | postgres.TransactionSql,
  organizationId: string,
  memberId: string,
  correlationId: string,
): Promise<void> {
  const [profile] = await sql<Pick<ProfileRow, "id" | "email">[]>`
    select p.id, p.email from organization_members om join profiles p on p.id = om.profile_id where om.id = ${memberId}
  `;
  if (!profile) return;

  const [invitation] = await sql<OrganizationInvitationRow[]>`
    update organization_invitations set status = 'accepted', accepted_at = now()
    where organization_id = ${organizationId} and lower(email) = ${profile.email.toLowerCase()} and status = 'pending'
    returning *
  `;
  if (!invitation) return;

  await sql`
    update organization_members set
      location_id = ${invitation.location_id},
      department_id = ${invitation.department_id}
    where id = ${memberId}
  `;

  if (invitation.role_id) {
    await sql`
      insert into member_role_assignments (organization_id, organization_member_id, role_id)
      values (${organizationId}, ${memberId}, ${invitation.role_id})
      on conflict (organization_member_id, role_id) do nothing
    `;
  }

  if (invitation.team_id) {
    await sql`
      insert into team_members (organization_id, team_id, organization_member_id)
      values (${organizationId}, ${invitation.team_id}, ${memberId})
      on conflict (team_id, organization_member_id) do nothing
    `;
  }

  await recordAuditEvent(sql, {
    organizationId,
    actorProfileId: profile.id,
    action: AuditAction.InvitationAccepted,
    resourceType: AuditResourceType.Invitation,
    resourceId: invitation.id,
    correlationId,
    source: "webhook",
  });
}

export async function syncMembershipRemoved(
  sql: postgres.Sql | postgres.TransactionSql,
  data: ClerkMembershipPayload,
  correlationId: string,
): Promise<{ organizationId: string } | null> {
  const [member] = await sql<Pick<OrganizationMemberRow, "id" | "organization_id">[]>`
    update organization_members
    set status = 'removed', updated_at = now()
    where clerk_membership_id = ${data.id}
    returning id, organization_id
  `;

  if (!member) return null;

  await recordAuditEvent(sql, {
    organizationId: member.organization_id,
    action: "membership.removed",
    resourceType: "organization_member",
    resourceId: member.id,
    correlationId,
    source: "webhook",
    metadata: { clerkMembershipId: data.id },
  });

  return { organizationId: member.organization_id };
}
