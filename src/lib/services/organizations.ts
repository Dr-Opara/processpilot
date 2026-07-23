import "server-only";
import { z } from "zod";
import type postgres from "postgres";
import { requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import type {
  OnboardingStep,
  OrganizationRow,
  OrganizationSettingsRow,
} from "@/lib/db/database.types";

/**
 * Slugs double as the workspace's identifier in URLs — reserved names
 * prevent a customer from claiming a path ProcessPilot itself needs
 * (marketing routes, /app itself, API prefixes), and the character rule
 * keeps them safe to place directly into a URL segment with no escaping.
 */
const RESERVED_SLUGS = new Set([
  "app",
  "api",
  "www",
  "admin",
  "auth",
  "sign-in",
  "sign-up",
  "processpilot",
  "product",
  "pricing",
  "security",
  "privacy",
  "terms",
  "resources",
  "solutions",
  "industries",
  "company",
  "design-system",
  "settings",
  "billing",
  "support",
  "help",
  "null",
  "undefined",
]);

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Workspace slug must be at least 2 characters.")
  .max(63, "Workspace slug must be 63 characters or fewer.")
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    "Workspace slug can only contain lowercase letters, numbers, and single hyphens.",
  )
  .refine((slug) => !RESERVED_SLUGS.has(slug), "This workspace slug is reserved.");

export const companyProfileInputSchema = z.object({
  name: z.string().trim().min(1, "Operating name is required").max(200),
  legalName: z.string().trim().max(200).optional().nullable(),
  slug: slugSchema,
  industry: z.string().trim().max(100).optional().nullable(),
  employeeCountRange: z.string().trim().max(50).optional().nullable(),
  websiteUrl: z
    .string()
    .trim()
    .url("Enter a valid URL.")
    .max(300)
    .optional()
    .nullable()
    .or(z.literal("")),
  country: z.string().trim().max(100).optional().nullable(),
  timezone: z.string().trim().max(100),
  dateFormat: z.string().trim().max(20),
  weekStart: z.enum(["sunday", "monday"]),
  primaryUseCase: z.string().trim().max(200).optional().nullable(),
});

export type CompanyProfileInput = z.infer<typeof companyProfileInputSchema>;

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

export interface OnboardingState {
  organization: OrganizationRow;
  settings: OrganizationSettingsRow;
}

export async function getOnboardingState(): Promise<OnboardingState> {
  const membership = await requirePermission("organization.settings");
  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [settings] = await tx<OrganizationSettingsRow[]>`
      select * from organization_settings where organization_id = ${membership.organization.id}
    `;
    if (!settings) throw new AppError("not_found", "Organization settings not found.");
    return { organization: membership.organization, settings };
  });
}

export async function updateCompanyProfile(input: CompanyProfileInput): Promise<OnboardingState> {
  const data = companyProfileInputSchema.parse(input);
  const membership = await requirePermission("organization.settings");

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [slugConflict] = await tx<{ id: string }[]>`
      select id from organizations where lower(slug) = ${data.slug} and id <> ${membership.organization.id}
    `;
    if (slugConflict) throw new AppError("conflict", "This workspace slug is already in use.");

    let organization: OrganizationRow;
    try {
      [organization] = await tx<OrganizationRow[]>`
        update organizations set
          name = ${data.name},
          legal_name = ${data.legalName || null},
          slug = ${data.slug},
          industry = ${data.industry || null},
          employee_count_range = ${data.employeeCountRange || null},
          website_url = ${data.websiteUrl || null},
          country = ${data.country || null}
        where id = ${membership.organization.id}
        returning *
      `;
    } catch {
      throw new AppError("conflict", "This workspace slug is already in use.");
    }

    const [settings] = await tx<OrganizationSettingsRow[]>`
      update organization_settings set
        timezone = ${data.timezone},
        date_format = ${data.dateFormat},
        week_start = ${data.weekStart},
        onboarding_data = onboarding_data || ${tx.json({ primaryUseCase: data.primaryUseCase ?? null })}
      where organization_id = ${membership.organization.id}
      returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.CompanyProfileChanged,
      resourceType: AuditResourceType.Organization,
      resourceId: membership.organization.id,
      source: "app",
    });

    return { organization, settings };
  });
}

const ONBOARDING_STEP_ORDER: OnboardingStep[] = [
  "welcome",
  "company_profile",
  "locations",
  "departments",
  "teams",
  "invite_employees",
  "review",
  "finished",
];

export async function advanceOnboardingStep(
  step: OnboardingStep,
  data?: Record<string, postgres.JSONValue>,
): Promise<OrganizationSettingsRow> {
  if (!ONBOARDING_STEP_ORDER.includes(step)) {
    throw new AppError("conflict", "Unknown onboarding step.");
  }
  const membership = await requirePermission("organization.settings");

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [settings] = await tx<OrganizationSettingsRow[]>`
      update organization_settings set
        onboarding_step = ${step},
        onboarding_data = onboarding_data || ${tx.json(data ?? {})},
        onboarding_completed_at = ${step === "finished" ? tx`now()` : tx`onboarding_completed_at`}
      where organization_id = ${membership.organization.id}
      returning *
    `;
    if (!settings) throw new AppError("not_found", "Organization settings not found.");

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action:
        step === "finished" ? AuditAction.OnboardingCompleted : AuditAction.OnboardingStepAdvanced,
      resourceType: AuditResourceType.Organization,
      resourceId: membership.organization.id,
      source: "app",
      metadata: { step },
    });

    return settings;
  });
}
