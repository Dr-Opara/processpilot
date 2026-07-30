import "server-only";
import { z } from "zod";
import { getCurrentMembership } from "@/lib/authz";
import type { CurrentMembership } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import type { OrganizationSettingsRow } from "@/lib/db/database.types";
import { LEGAL_DOCUMENTS } from "@/content/legal";

/**
 * Terms-of-service acceptance recording and self-service member data
 * export (Phase 25). Acceptance is recorded at the organization level
 * (organization_settings.settings.legal, the same extensible jsonb
 * namespace Phase 21's organization-settings-extended.ts established)
 * rather than a new table — one acceptance record per organization,
 * captured from whoever completes onboarding as the organization's
 * authorized representative, consistent with a B2B SaaS agreement
 * (not a separate individual click-through per member).
 */

function toTenantContext(membership: CurrentMembership) {
  return {
    organizationId: membership.organization.id,
    memberId: membership.member.id,
    clerkUserId: membership.profile.clerk_user_id,
  };
}

export interface TermsAcceptance {
  accepted: boolean;
  version: string | null;
  acceptedAt: string | null;
  acceptedByProfileId: string | null;
}

export async function getTermsAcceptance(): Promise<TermsAcceptance> {
  const membership = await getCurrentMembership();

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [settings] = await tx<OrganizationSettingsRow[]>`
      select * from organization_settings where organization_id = ${membership.organization.id}
    `;
    if (!settings) throw new AppError("not_found", "Organization settings not found.");

    const legal = (settings.settings.legal ?? {}) as {
      termsAcceptedVersion?: string;
      termsAcceptedAt?: string;
      termsAcceptedByProfileId?: string;
    };

    return {
      accepted: Boolean(legal.termsAcceptedAt),
      version: legal.termsAcceptedVersion ?? null,
      acceptedAt: legal.termsAcceptedAt ?? null,
      acceptedByProfileId: legal.termsAcceptedByProfileId ?? null,
    };
  });
}

export const recordTermsAcceptanceInputSchema = z.object({
  version: z.string().min(1).default(LEGAL_DOCUMENTS.terms.version),
});
export type RecordTermsAcceptanceInput = z.input<typeof recordTermsAcceptanceInputSchema>;

export async function recordTermsAcceptance(input: RecordTermsAcceptanceInput = {}): Promise<void> {
  const data = recordTermsAcceptanceInputSchema.parse(input);
  const membership = await getCurrentMembership();

  await withTenantContext(toTenantContext(membership), async (tx) => {
    await tx`
      update organization_settings set
        settings = settings || ${tx.json({
          legal: {
            termsAcceptedVersion: data.version,
            termsAcceptedAt: new Date().toISOString(),
            termsAcceptedByProfileId: membership.profile.id,
          },
        })}
      where organization_id = ${membership.organization.id}
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.TermsAccepted,
      resourceType: AuditResourceType.Organization,
      resourceId: membership.organization.id,
      source: "app",
      metadata: { version: data.version },
    });
  });
}

export interface MemberDataExport {
  exportedAt: string;
  profile: { email: string; firstName: string | null; lastName: string | null };
  membership: {
    status: string;
    jobTitle: string | null;
    startDate: string | null;
    roles: string[];
  };
  recentActivity: { action: string; createdAt: string }[];
}

/**
 * Self-service "export my data" — bounded to the calling member's own
 * profile, membership record, and their own recent audit-actor history
 * (never another member's data, never full organization content — a
 * broader organization-wide export is the admin-assisted
 * audit.export path already documented in the Privacy Policy).
 */
export async function exportMyData(): Promise<MemberDataExport> {
  const membership = await getCurrentMembership();

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const roles = await tx<{ name: string }[]>`
      select r.name from member_role_assignments mra
      join roles r on r.id = mra.role_id
      where mra.organization_member_id = ${membership.member.id}
    `;
    const recentActivity = await tx<{ action: string; created_at: string }[]>`
      select action, created_at from audit_events
      where organization_id = ${membership.organization.id} and actor_profile_id = ${membership.profile.id}
      order by created_at desc
      limit 200
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.DataExportRequested,
      resourceType: AuditResourceType.Member,
      resourceId: membership.member.id,
      source: "app",
    });

    return {
      exportedAt: new Date().toISOString(),
      profile: {
        email: membership.profile.email,
        firstName: membership.profile.first_name,
        lastName: membership.profile.last_name,
      },
      membership: {
        status: membership.member.status,
        jobTitle: membership.member.job_title,
        startDate: membership.member.start_date,
        roles: roles.map((r) => r.name),
      },
      recentActivity: recentActivity.map((row) => ({
        action: row.action,
        createdAt: row.created_at,
      })),
    };
  });
}
