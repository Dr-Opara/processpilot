import "server-only";
import { requirePermission } from "@/lib/authz";
import { withTenantContext } from "@/lib/db/tenant-context";
import type { AnalyticsFilters } from "@/lib/services/analytics-workflows";

/**
 * Training-compliance and corrective-action-closure metrics, per
 * product/success-metrics.md's operational value metrics — live
 * aggregates over Phase 11's `capa_plans` and Phase 12's
 * `training_assignments`/`certifications`, same "no cached snapshot"
 * posture as analytics-workflows.ts.
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

export interface TrainingComplianceResult {
  totalAssignments: number;
  completedOnTime: number;
  /** null when there are no assignments yet. */
  onTimeCompletionRate: number | null;
  activeCertifications: number;
  expiredCertifications: number;
  /** null when there are no non-revoked certifications yet. */
  certificationCurrencyRate: number | null;
}

export async function getTrainingCompliance(
  filters: AnalyticsFilters = {},
): Promise<TrainingComplianceResult> {
  const membership = await requirePermission("analytics.view", {
    scope: { departmentId: filters.departmentId },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [assignmentRow] = await tx<{ total: string; on_time: string }[]>`
      select
        count(*) as total,
        count(*) filter (
          where status = 'completed' and (due_at is null or completed_at <= due_at)
        ) as on_time
      from training_assignments
      where organization_id = ${membership.organization.id}
        and (${filters.departmentId ?? null}::uuid is null or department_id = ${filters.departmentId ?? null})
    `;

    const [certRow] = await tx<{ active: string; expired: string }[]>`
      select
        count(*) filter (where status = 'active') as active,
        count(*) filter (where status = 'expired') as expired
      from certifications
      where organization_id = ${membership.organization.id}
        and (${filters.departmentId ?? null}::uuid is null or department_id = ${filters.departmentId ?? null})
    `;

    const totalAssignments = Number(assignmentRow?.total ?? 0);
    const completedOnTime = Number(assignmentRow?.on_time ?? 0);
    const activeCertifications = Number(certRow?.active ?? 0);
    const expiredCertifications = Number(certRow?.expired ?? 0);
    const certificationDenominator = activeCertifications + expiredCertifications;

    return {
      totalAssignments,
      completedOnTime,
      onTimeCompletionRate: totalAssignments > 0 ? completedOnTime / totalAssignments : null,
      activeCertifications,
      expiredCertifications,
      certificationCurrencyRate:
        certificationDenominator > 0 ? activeCertifications / certificationDenominator : null,
    };
  });
}

export interface CapaClosureResult {
  totalPlans: number;
  closedPlans: number;
  /** null when there are no CAPA plans yet. */
  closureRate: number | null;
  medianDaysToClose: number | null;
}

export async function getCapaClosureStats(
  filters: AnalyticsFilters = {},
): Promise<CapaClosureResult> {
  const membership = await requirePermission("analytics.view", {
    scope: { departmentId: filters.departmentId },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [row] = await tx<{ total: string; closed: string; median_days: number | null }[]>`
      select
        count(*) as total,
        count(*) filter (where status = 'closed') as closed,
        percentile_cont(0.5) within group (
          order by extract(epoch from (closed_at - created_at)) / 86400
        ) filter (where status = 'closed') as median_days
      from capa_plans
      where organization_id = ${membership.organization.id}
        and (${filters.departmentId ?? null}::uuid is null or department_id = ${filters.departmentId ?? null})
    `;

    const totalPlans = Number(row?.total ?? 0);
    const closedPlans = Number(row?.closed ?? 0);
    return {
      totalPlans,
      closedPlans,
      closureRate: totalPlans > 0 ? closedPlans / totalPlans : null,
      medianDaysToClose: row?.median_days ?? null,
    };
  });
}
