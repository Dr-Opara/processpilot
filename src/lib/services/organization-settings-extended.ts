import "server-only";
import { z } from "zod";
import { requirePermission } from "@/lib/authz";
import type { CurrentMembership } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import type { OrganizationRow, OrganizationSettingsRow } from "@/lib/db/database.types";

/**
 * Branding, security/session-policy preferences, and data-retention
 * preferences — all stored in organization_settings.settings (jsonb,
 * unused until this phase), namespaced by concern, rather than three new
 * tables for what is fundamentally organization-wide preference storage.
 *
 * Honesty note: `security` and `dataRetention` here are *stored
 * preferences*, not automatically-enforced controls. Session lifetime is
 * actually governed by Clerk at the instance level (ADR-0003), not
 * per-organization — sessionIdleTimeoutMinutes is advisory/display-only
 * until a real per-org enforcement mechanism exists. Retention days are
 * not wired to any purge job in this phase — see
 * docs/architecture/organization-administration.md's known gaps. Neither
 * field is presented anywhere in the UI as an active control; both are
 * labeled "planned" / "not yet enforced."
 */

function toTenantContext(membership: CurrentMembership) {
  return {
    organizationId: membership.organization.id,
    memberId: membership.member.id,
    clerkUserId: membership.profile.clerk_user_id,
  };
}

export interface OrganizationBranding {
  logoUrl: string | null;
  brandColor: string | null;
  locale: string;
}

export interface OrganizationSecuritySettings {
  sessionIdleTimeoutMinutes: number | null;
  requireVerifiedDomainSignup: boolean;
}

export interface OrganizationDataRetentionSettings {
  auditRetentionDays: number | null;
  evidenceRetentionDays: number | null;
  exceptionRetentionDays: number | null;
}

function readSettingsSection<T>(settings: Record<string, unknown>, key: string, fallback: T): T {
  const section = settings[key];
  return section && typeof section === "object" ? { ...fallback, ...section } : fallback;
}

export async function getExtendedOrganizationSettings(): Promise<{
  branding: OrganizationBranding;
  security: OrganizationSecuritySettings;
  dataRetention: OrganizationDataRetentionSettings;
}> {
  const membership = await requirePermission("organization.settings");

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [organization] = await tx<OrganizationRow[]>`
      select * from organizations where id = ${membership.organization.id}
    `;
    const [settingsRow] = await tx<OrganizationSettingsRow[]>`
      select * from organization_settings where organization_id = ${membership.organization.id}
    `;
    if (!organization || !settingsRow) throw new AppError("not_found", "Organization not found.");

    return {
      branding: {
        logoUrl: organization.logo_url,
        locale: settingsRow.locale,
        ...readSettingsSection(settingsRow.settings, "branding", {
          brandColor: null as string | null,
        }),
      },
      security: readSettingsSection(settingsRow.settings, "security", {
        sessionIdleTimeoutMinutes: null,
        requireVerifiedDomainSignup: false,
      }),
      dataRetention: readSettingsSection(settingsRow.settings, "dataRetention", {
        auditRetentionDays: null,
        evidenceRetentionDays: null,
        exceptionRetentionDays: null,
      }),
    };
  });
}

export const brandingInputSchema = z.object({
  logoUrl: z.string().trim().url().max(1000).optional().nullable().or(z.literal("")),
  brandColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Enter a hex color like #1A2B3C.")
    .optional()
    .nullable()
    .or(z.literal("")),
  locale: z.string().trim().min(2).max(20),
});
export type BrandingInput = z.infer<typeof brandingInputSchema>;

export async function updateBranding(input: BrandingInput): Promise<void> {
  const data = brandingInputSchema.parse(input);
  const membership = await requirePermission("organization.settings");

  await withTenantContext(toTenantContext(membership), async (tx) => {
    await tx`
      update organizations set logo_url = ${data.logoUrl || null}
      where id = ${membership.organization.id}
    `;
    await tx`
      update organization_settings set
        locale = ${data.locale},
        settings = settings || ${tx.json({ branding: { brandColor: data.brandColor || null } })}
      where organization_id = ${membership.organization.id}
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.BrandingUpdated,
      resourceType: AuditResourceType.Organization,
      resourceId: membership.organization.id,
      source: "app",
    });
  });
}

export const securitySettingsInputSchema = z.object({
  sessionIdleTimeoutMinutes: z.number().int().min(5).max(10080).optional().nullable(),
  requireVerifiedDomainSignup: z.boolean(),
});
export type SecuritySettingsInput = z.infer<typeof securitySettingsInputSchema>;

export async function updateSecuritySettings(input: SecuritySettingsInput): Promise<void> {
  const data = securitySettingsInputSchema.parse(input);
  const membership = await requirePermission("organization.settings");

  await withTenantContext(toTenantContext(membership), async (tx) => {
    await tx`
      update organization_settings set settings = settings || ${tx.json({ security: data })}
      where organization_id = ${membership.organization.id}
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.SecuritySettingsUpdated,
      resourceType: AuditResourceType.Organization,
      resourceId: membership.organization.id,
      source: "app",
      metadata: data,
    });
  });
}

export const dataRetentionSettingsInputSchema = z.object({
  auditRetentionDays: z.number().int().min(30).max(3650).optional().nullable(),
  evidenceRetentionDays: z.number().int().min(30).max(3650).optional().nullable(),
  exceptionRetentionDays: z.number().int().min(30).max(3650).optional().nullable(),
});
export type DataRetentionSettingsInput = z.infer<typeof dataRetentionSettingsInputSchema>;

export async function updateDataRetentionSettings(
  input: DataRetentionSettingsInput,
): Promise<void> {
  const data = dataRetentionSettingsInputSchema.parse(input);
  const membership = await requirePermission("organization.settings");

  await withTenantContext(toTenantContext(membership), async (tx) => {
    await tx`
      update organization_settings set settings = settings || ${tx.json({ dataRetention: data })}
      where organization_id = ${membership.organization.id}
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.DataRetentionSettingsUpdated,
      resourceType: AuditResourceType.Organization,
      resourceId: membership.organization.id,
      source: "app",
      metadata: data,
    });
  });
}
