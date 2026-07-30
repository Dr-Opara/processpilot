import type { OrganizationRow } from "@/lib/db/database.types";

/**
 * The single check point every real-external-side-effect code path
 * (email delivery, outbound webhooks, the AI copilot) uses to decide
 * whether it's safe to actually reach an external provider. The demo
 * workspace (Phase 28) is a real, ordinary tenant in every other
 * respect — same RLS, same tables — so this check must be applied
 * explicitly at each external boundary rather than relied on
 * implicitly.
 */
export function isDemoOrganization(organization: Pick<OrganizationRow, "is_demo">): boolean {
  return organization.is_demo;
}
