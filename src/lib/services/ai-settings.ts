import "server-only";
import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { withTenantContext } from "@/lib/db/tenant-context";
import { isAiConfigured } from "@/lib/ai/availability";

/**
 * Organization-level AI copilot toggle, on top of `feature_flags`
 * (Phase 0's schema, first real consumer here) — distinct from
 * `isAiConfigured()` (an environment/ops concern: is there a real
 * credential at all). An organization can be configured but still have
 * the copilot switched off by an `ai.configure` holder; every ai-*.ts
 * service checks both before calling the adapter.
 */
const AI_COPILOT_FLAG_KEY = "ai_copilot_enabled";

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

/** True only when the AI adapter has a real credential AND the organization has switched the copilot on. Defaults to on once configured (feature_flags' typical "off unless a row exists" default would silently disable AI for every existing org) — an org can still explicitly disable it via setAiCopilotEnabled(). */
export async function isAiCopilotEnabledForOrg(): Promise<boolean> {
  if (!isAiConfigured()) return false;
  const membership = await getCurrentMembership();
  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [flag] = await tx<{ enabled: boolean }[]>`
      select enabled from feature_flags where organization_id = ${membership.organization.id} and key = ${AI_COPILOT_FLAG_KEY}
    `;
    return flag ? flag.enabled : true;
  });
}

export async function setAiCopilotEnabled(enabled: boolean): Promise<void> {
  const membership = await requirePermission("ai.configure");
  await withTenantContext(
    toTenantContext(membership),
    (tx) =>
      tx`
      insert into feature_flags (organization_id, key, enabled, created_by)
      values (${membership.organization.id}, ${AI_COPILOT_FLAG_KEY}, ${enabled}, ${membership.profile.id})
      on conflict (organization_id, key) do update set enabled = excluded.enabled, updated_at = now()
    `,
  );
}
