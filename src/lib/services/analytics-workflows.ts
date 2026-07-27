import "server-only";
import { requirePermission } from "@/lib/authz";
import { withTenantContext } from "@/lib/db/tenant-context";

/**
 * Operational analytics over workflows/exceptions, per
 * product/success-metrics.md's "operational value" metrics — completion
 * rate, median cycle time, exception rate, and audit readiness. Every
 * number here is computed live from the same tenant-scoped tables the
 * rest of the app reads/writes; there is no cached/precomputed
 * snapshot, so a dashboard can never show a stale or fabricated figure
 * — the accepted tradeoff (query cost at scale) is this phase's own
 * documented risk, deferred to Phase 23 (observability) if it becomes a
 * real bottleneck.
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

export interface AnalyticsFilters {
  departmentId?: string;
  locationId?: string;
}

export interface ProcessAnalyticsRow {
  processId: string;
  processTitle: string;
  workflowsStarted: number;
  workflowsCompleted: number;
  /** null when no workflow has started yet — never fabricated as 0%. */
  completionRate: number | null;
  medianCycleTimeMinutes: number | null;
  exceptionCount: number;
  /** Exceptions per completed workflow — null when nothing has completed yet. */
  exceptionRate: number | null;
}

/** One row per process the caller can see, optionally narrowed to a single process/department/location. */
export async function listProcessAnalytics(
  filters: AnalyticsFilters & { processId?: string } = {},
): Promise<ProcessAnalyticsRow[]> {
  const membership = await requirePermission("analytics.view", {
    scope: { departmentId: filters.departmentId },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const rows = await tx<
      {
        process_id: string;
        process_title: string;
        workflows_started: string;
        workflows_completed: string;
        median_cycle_time_minutes: number | null;
        exception_count: string;
      }[]
    >`
      with workflow_stats as (
        select
          process_id,
          count(*) as started,
          count(*) filter (where status = 'completed') as completed,
          percentile_cont(0.5) within group (
            order by extract(epoch from (completed_at - started_at)) / 60
          ) filter (where status = 'completed') as median_cycle_time_minutes
        from workflows
        where organization_id = ${membership.organization.id}
          and (${filters.departmentId ?? null}::uuid is null or department_id = ${filters.departmentId ?? null})
        group by process_id
      ),
      exception_stats as (
        select process_id, count(*) as exception_count
        from exceptions
        where organization_id = ${membership.organization.id} and process_id is not null
        group by process_id
      )
      select
        p.id as process_id,
        p.title as process_title,
        coalesce(ws.started, 0) as workflows_started,
        coalesce(ws.completed, 0) as workflows_completed,
        ws.median_cycle_time_minutes,
        coalesce(es.exception_count, 0) as exception_count
      from processes p
      left join workflow_stats ws on ws.process_id = p.id
      left join exception_stats es on es.process_id = p.id
      where p.organization_id = ${membership.organization.id}
        and (${filters.locationId ?? null}::uuid is null or p.location_id = ${filters.locationId ?? null})
        and (${filters.processId ?? null}::uuid is null or p.id = ${filters.processId ?? null})
      order by p.title asc
    `;

    return rows.map((row) => {
      const started = Number(row.workflows_started);
      const completed = Number(row.workflows_completed);
      const exceptionCount = Number(row.exception_count);
      return {
        processId: row.process_id,
        processTitle: row.process_title,
        workflowsStarted: started,
        workflowsCompleted: completed,
        completionRate: started > 0 ? completed / started : null,
        medianCycleTimeMinutes: row.median_cycle_time_minutes,
        exceptionCount,
        exceptionRate: completed > 0 ? exceptionCount / completed : null,
      };
    });
  });
}

export interface WorkflowTrendPoint {
  weekStart: string;
  started: number;
  completed: number;
  exceptions: number;
}

/** Weekly-bucketed started/completed/exception counts over the trailing `weeks` weeks — a trend view scoped by department/location. */
export async function getWorkflowTrend(
  filters: AnalyticsFilters & { weeks?: number } = {},
): Promise<WorkflowTrendPoint[]> {
  const weeks = Math.min(Math.max(filters.weeks ?? 12, 1), 52);
  const membership = await requirePermission("analytics.view", {
    scope: { departmentId: filters.departmentId },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const rows = await tx<
      { week_start: string; started: string; completed: string; exceptions: string }[]
    >`
      with weeks as (
        select generate_series(date_trunc('week', now()) - (${weeks}::int - 1) * interval '1 week', date_trunc('week', now()), interval '1 week') as week_start
      ),
      started_counts as (
        select date_trunc('week', w.started_at) as week_start, count(*) as started
        from workflows w
        where organization_id = ${membership.organization.id}
          and (${filters.departmentId ?? null}::uuid is null or department_id = ${filters.departmentId ?? null})
          and (${filters.locationId ?? null}::uuid is null or exists (
            select 1 from processes p where p.id = w.process_id and p.location_id = ${filters.locationId ?? null}
          ))
        group by date_trunc('week', w.started_at)
      ),
      completed_counts as (
        select date_trunc('week', w.completed_at) as week_start, count(*) as completed
        from workflows w
        where organization_id = ${membership.organization.id} and status = 'completed'
          and (${filters.departmentId ?? null}::uuid is null or department_id = ${filters.departmentId ?? null})
          and (${filters.locationId ?? null}::uuid is null or exists (
            select 1 from processes p where p.id = w.process_id and p.location_id = ${filters.locationId ?? null}
          ))
        group by date_trunc('week', w.completed_at)
      ),
      exception_counts as (
        select date_trunc('week', created_at) as week_start, count(*) as exceptions
        from exceptions
        where organization_id = ${membership.organization.id}
          and (${filters.departmentId ?? null}::uuid is null or department_id = ${filters.departmentId ?? null})
        group by date_trunc('week', created_at)
      )
      select
        to_char(w.week_start, 'YYYY-MM-DD') as week_start,
        coalesce(sc.started, 0) as started,
        coalesce(cc.completed, 0) as completed,
        coalesce(ec.exceptions, 0) as exceptions
      from weeks w
      left join started_counts sc on sc.week_start = w.week_start
      left join completed_counts cc on cc.week_start = w.week_start
      left join exception_counts ec on ec.week_start = w.week_start
      order by w.week_start asc
    `;

    return rows.map((row) => ({
      weekStart: row.week_start,
      started: Number(row.started),
      completed: Number(row.completed),
      exceptions: Number(row.exceptions),
    }));
  });
}

export interface AuditReadinessResult {
  completedWorkflows: number;
  workflowsWithGaps: number;
  /** null when no workflow has completed yet. */
  readinessRate: number | null;
}

/**
 * "Percentage of completed workflows with complete evidence/approval
 * trails" (success-metrics.md). Only evidence is actually at risk of a
 * gap: a required `approval` task can only let its workflow reach
 * `completed` after being decided (a rejected required approval fails
 * the workflow instead — see workflow-engine.ts), but a required
 * `evidence` task completes generically regardless of whether evidence
 * was ever accepted (forms-and-evidence.md's own documented gap) — so
 * this checks exactly that: any required evidence-node task on a
 * completed workflow with zero accepted evidence records counts as a
 * gap.
 */
export async function getAuditReadiness(
  filters: AnalyticsFilters = {},
): Promise<AuditReadinessResult> {
  const membership = await requirePermission("analytics.view", {
    scope: { departmentId: filters.departmentId },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [row] = await tx<{ completed_total: string; with_gaps: string }[]>`
      with completed_workflows as (
        select id from workflows
        where organization_id = ${membership.organization.id} and status = 'completed'
          and (${filters.departmentId ?? null}::uuid is null or department_id = ${filters.departmentId ?? null})
      ),
      gapped_workflows as (
        select distinct t.workflow_id
        from tasks t
        left join evidence ev on ev.task_id = t.id and ev.status = 'accepted'
        where t.workflow_id in (select id from completed_workflows)
          and t.node_type = 'evidence' and t.required = true
        group by t.workflow_id, t.id
        having count(ev.id) = 0
      )
      select
        (select count(*) from completed_workflows) as completed_total,
        (select count(*) from (select distinct workflow_id from gapped_workflows) as g) as with_gaps
    `;

    const completedWorkflows = Number(row?.completed_total ?? 0);
    const workflowsWithGaps = Number(row?.with_gaps ?? 0);
    return {
      completedWorkflows,
      workflowsWithGaps,
      readinessRate:
        completedWorkflows > 0
          ? (completedWorkflows - workflowsWithGaps) / completedWorkflows
          : null,
    };
  });
}
