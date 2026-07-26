import { Heading, Text } from "@/components/ui/Typography";
import { Stack, Cluster, ScrollArea } from "@/components/ui/Layout";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import {
  getAuditReadiness,
  getWorkflowTrend,
  listProcessAnalytics,
} from "@/lib/services/analytics-workflows";
import { getCapaClosureStats, getTrainingCompliance } from "@/lib/services/analytics-compliance";
import { getAiDraftAcceptanceStats } from "@/lib/services/ai-drafts";
import { listDepartments } from "@/lib/services/departments";
import { listLocations } from "@/lib/services/locations";
import { AppError } from "@/lib/errors";

function formatPercent(rate: number | null): string {
  return rate === null ? "No data yet" : `${Math.round(rate * 100)}%`;
}

function formatMinutes(minutes: number | null): string {
  if (minutes === null) return "No data yet";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)} hr`;
  return `${(hours / 24).toFixed(1)} days`;
}

function rateBadgeStatus(rate: number | null): "success" | "warning" | "danger" | "neutral" {
  if (rate === null) return "neutral";
  if (rate >= 0.9) return "success";
  if (rate >= 0.6) return "warning";
  return "danger";
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ departmentId?: string; locationId?: string; error?: string }>;
}) {
  const { departmentId, locationId, error } = await searchParams;
  const filters = { departmentId: departmentId || undefined, locationId: locationId || undefined };

  let loadError: string | null = null;
  let processRows: Awaited<ReturnType<typeof listProcessAnalytics>> = [];
  let trend: Awaited<ReturnType<typeof getWorkflowTrend>> = [];
  let training: Awaited<ReturnType<typeof getTrainingCompliance>> | null = null;
  let capa: Awaited<ReturnType<typeof getCapaClosureStats>> | null = null;
  let auditReadiness: Awaited<ReturnType<typeof getAuditReadiness>> | null = null;
  let aiStats: Awaited<ReturnType<typeof getAiDraftAcceptanceStats>> | null = null;
  let departments: Awaited<ReturnType<typeof listDepartments>> = [];
  // listLocations() requires location.manage, which most analytics viewers
  // won't hold — fetched independently so a lack of that permission only
  // hides the location filter's option list, not the whole dashboard.
  let locations: Awaited<ReturnType<typeof listLocations>> = [];

  try {
    [processRows, trend, training, capa, auditReadiness, aiStats, departments] = await Promise.all([
      listProcessAnalytics(filters),
      getWorkflowTrend({ ...filters, weeks: 12 }),
      getTrainingCompliance(filters),
      getCapaClosureStats(filters),
      getAuditReadiness(filters),
      getAiDraftAcceptanceStats().catch(() => null),
      listDepartments(),
    ]);
  } catch (err) {
    loadError = err instanceof AppError ? err.message : "Could not load analytics.";
  }

  locations = await listLocations().catch(() => []);

  const orgTotals = processRows.reduce(
    (acc, row) => ({
      started: acc.started + row.workflowsStarted,
      completed: acc.completed + row.workflowsCompleted,
      exceptions: acc.exceptions + row.exceptionCount,
    }),
    { started: 0, completed: 0, exceptions: 0 },
  );
  const orgCompletionRate = orgTotals.started > 0 ? orgTotals.completed / orgTotals.started : null;
  const orgExceptionRate =
    orgTotals.completed > 0 ? orgTotals.exceptions / orgTotals.completed : null;

  return (
    <Stack className="mx-auto max-w-5xl gap-8">
      <Stack className="gap-1">
        <Heading as="h1">Analytics</Heading>
        <Text className="text-muted">
          Live, correctly-scoped figures only — a metric reads &quot;No data yet&quot; rather than a
          fabricated zero or placeholder when nothing has happened yet.
        </Text>
      </Stack>

      {(error || loadError) && (
        <Alert title="Could not load analytics" description={error ?? loadError ?? ""} />
      )}

      <form method="get" className="flex flex-wrap items-end gap-3">
        <Stack className="gap-1">
          <label htmlFor="departmentId" className="text-xs font-medium text-muted">
            Department
          </label>
          <Select
            id="departmentId"
            name="departmentId"
            defaultValue={departmentId ?? ""}
            className="w-56"
          >
            <option value="">All departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </Select>
        </Stack>
        <Stack className="gap-1">
          <label htmlFor="locationId" className="text-xs font-medium text-muted">
            Location
          </label>
          <Select
            id="locationId"
            name="locationId"
            defaultValue={locationId ?? ""}
            className="w-56"
          >
            <option value="">All locations</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </Select>
        </Stack>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </form>

      <Stack className="gap-3 rounded-md border border-border p-4">
        <Heading as="h2">Organization overview</Heading>
        <Cluster className="flex-wrap gap-6">
          <Stack className="gap-0">
            <Text className="text-xs text-muted">Workflow completion rate</Text>
            <Cluster className="items-center gap-2">
              <Text className="text-xl font-semibold">{formatPercent(orgCompletionRate)}</Text>
              <StatusBadge status={rateBadgeStatus(orgCompletionRate)}>
                {orgTotals.completed}/{orgTotals.started}
              </StatusBadge>
            </Cluster>
          </Stack>
          <Stack className="gap-0">
            <Text className="text-xs text-muted">Exception rate</Text>
            <Text className="text-xl font-semibold">{formatPercent(orgExceptionRate)}</Text>
          </Stack>
          <Stack className="gap-0">
            <Text className="text-xs text-muted">Audit readiness</Text>
            <Cluster className="items-center gap-2">
              <Text className="text-xl font-semibold">
                {formatPercent(auditReadiness?.readinessRate ?? null)}
              </Text>
              {auditReadiness && (
                <StatusBadge status={rateBadgeStatus(auditReadiness.readinessRate)}>
                  {auditReadiness.completedWorkflows - auditReadiness.workflowsWithGaps}/
                  {auditReadiness.completedWorkflows}
                </StatusBadge>
              )}
            </Cluster>
          </Stack>
        </Cluster>
      </Stack>

      <Stack className="gap-3 rounded-md border border-border p-4">
        <Heading as="h2">Training and CAPA compliance</Heading>
        <Cluster className="flex-wrap gap-6">
          <Stack className="gap-0">
            <Text className="text-xs text-muted">Training on-time completion</Text>
            <Text className="text-xl font-semibold">
              {formatPercent(training?.onTimeCompletionRate ?? null)}
            </Text>
          </Stack>
          <Stack className="gap-0">
            <Text className="text-xs text-muted">Certification currency</Text>
            <Text className="text-xl font-semibold">
              {formatPercent(training?.certificationCurrencyRate ?? null)}
            </Text>
          </Stack>
          <Stack className="gap-0">
            <Text className="text-xs text-muted">CAPA closure rate</Text>
            <Text className="text-xl font-semibold">
              {formatPercent(capa?.closureRate ?? null)}
            </Text>
          </Stack>
          <Stack className="gap-0">
            <Text className="text-xs text-muted">Median days to close a CAPA</Text>
            <Text className="text-xl font-semibold">
              {capa?.medianDaysToClose != null
                ? `${capa.medianDaysToClose.toFixed(1)} days`
                : "No data yet"}
            </Text>
          </Stack>
          {aiStats && (
            <Stack className="gap-0">
              <Text className="text-xs text-muted">AI draft acceptance rate</Text>
              <Text className="text-xl font-semibold">{formatPercent(aiStats.acceptanceRate)}</Text>
            </Stack>
          )}
        </Cluster>
      </Stack>

      <Stack className="gap-3">
        <Heading as="h2">By process</Heading>
        {processRows.length === 0 ? (
          <Text className="text-muted">No processes match this view.</Text>
        ) : (
          <ScrollArea>
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2 pr-4 font-medium">Process</th>
                  <th className="py-2 pr-4 font-medium">Started</th>
                  <th className="py-2 pr-4 font-medium">Completed</th>
                  <th className="py-2 pr-4 font-medium">Completion rate</th>
                  <th className="py-2 pr-4 font-medium">Median cycle time</th>
                  <th className="py-2 pr-4 font-medium">Exception rate</th>
                </tr>
              </thead>
              <tbody>
                {processRows.map((row) => (
                  <tr key={row.processId} className="border-b border-border/60">
                    <td className="py-2 pr-4 font-medium">{row.processTitle}</td>
                    <td className="py-2 pr-4">{row.workflowsStarted}</td>
                    <td className="py-2 pr-4">{row.workflowsCompleted}</td>
                    <td className="py-2 pr-4">{formatPercent(row.completionRate)}</td>
                    <td className="py-2 pr-4">{formatMinutes(row.medianCycleTimeMinutes)}</td>
                    <td className="py-2 pr-4">{formatPercent(row.exceptionRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </Stack>

      <Stack className="gap-3">
        <Heading as="h2">Trend — last 12 weeks</Heading>
        <ScrollArea>
          <table className="w-full min-w-[480px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 pr-4 font-medium">Week of</th>
                <th className="py-2 pr-4 font-medium">Started</th>
                <th className="py-2 pr-4 font-medium">Completed</th>
                <th className="py-2 pr-4 font-medium">Exceptions</th>
              </tr>
            </thead>
            <tbody>
              {trend.map((point) => (
                <tr key={point.weekStart} className="border-b border-border/60">
                  <td className="py-2 pr-4">{point.weekStart}</td>
                  <td className="py-2 pr-4">{point.started}</td>
                  <td className="py-2 pr-4">{point.completed}</td>
                  <td className="py-2 pr-4">{point.exceptions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      </Stack>
    </Stack>
  );
}
