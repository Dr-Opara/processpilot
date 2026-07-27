import { Heading, Text } from "@/components/ui/Typography";
import { Stack, Cluster, ScrollArea } from "@/components/ui/Layout";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { getCurrentMembership } from "@/lib/authz";
import { listAuditEvents } from "@/lib/services/audit";
import { listDepartments } from "@/lib/services/departments";
import { AppError } from "@/lib/errors";

const PAGE_SIZE = 50;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    action?: string;
    resourceType?: string;
    departmentId?: string;
    dateFrom?: string;
    dateTo?: string;
    offset?: string;
    error?: string;
  }>;
}) {
  const { action, resourceType, departmentId, dateFrom, dateTo, offset, error } =
    await searchParams;
  const filters = {
    action: action || undefined,
    resourceType: resourceType || undefined,
    departmentId: departmentId || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };
  const currentOffset = Math.max(Number(offset) || 0, 0);

  let loadError: string | null = null;
  let events: Awaited<ReturnType<typeof listAuditEvents>>["events"] = [];
  let hasMore = false;
  let canExport = false;
  let departments: Awaited<ReturnType<typeof listDepartments>> = [];

  try {
    const [membership, result, departmentList] = await Promise.all([
      getCurrentMembership(),
      listAuditEvents(filters, { limit: PAGE_SIZE, offset: currentOffset }),
      listDepartments(),
    ]);
    canExport =
      membership.permissions.includes("audit.export") ||
      membership.scopedPermissions.includes("audit.export");
    events = result.events;
    hasMore = result.hasMore;
    departments = departmentList;
  } catch (err) {
    loadError = err instanceof AppError ? err.message : "Could not load the audit log.";
  }

  const departmentName = (id: string | null) =>
    id ? (departments.find((d) => d.id === id)?.name ?? id) : "—";

  const queryFilters = Object.fromEntries(
    Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
  const queryString = new URLSearchParams(queryFilters).toString();

  return (
    <Stack className="mx-auto max-w-5xl gap-6">
      <Cluster className="justify-between">
        <Stack className="gap-1">
          <Heading as="h1">Audit log</Heading>
          <Text className="text-muted">
            An append-only record of every governance-relevant action — nothing here can be edited
            or deleted, only filtered and exported.
          </Text>
        </Stack>
        {canExport && (
          <Button
            href={`/app/audit/export${queryString ? `?${queryString}` : ""}`}
            variant="secondary"
          >
            Export CSV
          </Button>
        )}
      </Cluster>

      {(error || loadError) && (
        <Alert title="Could not load the audit log" description={error ?? loadError ?? ""} />
      )}

      <form method="get" className="flex flex-wrap items-end gap-3">
        <Stack className="gap-1">
          <label htmlFor="action" className="text-xs font-medium text-muted">
            Action
          </label>
          <input
            id="action"
            name="action"
            defaultValue={action ?? ""}
            placeholder="e.g. exception.closed"
            className="w-56 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink shadow-sm outline-none focus:border-cobalt focus:ring-2 focus:ring-cobalt/20"
          />
        </Stack>
        <Stack className="gap-1">
          <label htmlFor="resourceType" className="text-xs font-medium text-muted">
            Resource type
          </label>
          <input
            id="resourceType"
            name="resourceType"
            defaultValue={resourceType ?? ""}
            placeholder="e.g. exception"
            className="w-48 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink shadow-sm outline-none focus:border-cobalt focus:ring-2 focus:ring-cobalt/20"
          />
        </Stack>
        <Stack className="gap-1">
          <label htmlFor="departmentId" className="text-xs font-medium text-muted">
            Department
          </label>
          <Select
            id="departmentId"
            name="departmentId"
            defaultValue={departmentId ?? ""}
            className="w-48"
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
          <label htmlFor="dateFrom" className="text-xs font-medium text-muted">
            From
          </label>
          <input
            id="dateFrom"
            name="dateFrom"
            type="date"
            defaultValue={dateFrom ? dateFrom.slice(0, 10) : ""}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink shadow-sm outline-none focus:border-cobalt focus:ring-2 focus:ring-cobalt/20"
          />
        </Stack>
        <Stack className="gap-1">
          <label htmlFor="dateTo" className="text-xs font-medium text-muted">
            To
          </label>
          <input
            id="dateTo"
            name="dateTo"
            type="date"
            defaultValue={dateTo ? dateTo.slice(0, 10) : ""}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink shadow-sm outline-none focus:border-cobalt focus:ring-2 focus:ring-cobalt/20"
          />
        </Stack>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </form>

      {!loadError && events.length === 0 && (
        <Alert
          title="No audit events match this view"
          description="Either nothing has happened yet within this filter, or your role's audit access doesn't extend to these events — a manager/auditor's scoped access only covers departments they own."
        />
      )}

      {!loadError && events.length > 0 && (
        <ScrollArea>
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 pr-4 font-medium">Timestamp</th>
                <th className="py-2 pr-4 font-medium">Action</th>
                <th className="py-2 pr-4 font-medium">Resource</th>
                <th className="py-2 pr-4 font-medium">Department</th>
                <th className="py-2 pr-4 font-medium">Actor</th>
                <th className="py-2 pr-4 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-b border-border/60">
                  <td className="py-2 pr-4 whitespace-nowrap text-muted">
                    {new Date(event.created_at).toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 font-medium">{event.action}</td>
                  <td className="py-2 pr-4">
                    {event.resource_type}
                    {event.resource_id ? ` (${event.resource_id.slice(0, 8)})` : ""}
                  </td>
                  <td className="py-2 pr-4">{departmentName(event.department_id)}</td>
                  <td className="py-2 pr-4">{event.actorName ?? "—"}</td>
                  <td className="py-2 pr-4 text-muted">{event.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      )}

      {!loadError && (events.length > 0 || currentOffset > 0) && (
        <Cluster className="justify-between text-sm">
          <Button
            href={`/app/audit?${new URLSearchParams({ ...queryFilters, offset: String(Math.max(currentOffset - PAGE_SIZE, 0)) }).toString()}`}
            variant="quiet"
            aria-disabled={currentOffset === 0}
          >
            Previous
          </Button>
          <Button
            href={`/app/audit?${new URLSearchParams({ ...queryFilters, offset: String(currentOffset + PAGE_SIZE) }).toString()}`}
            variant="quiet"
            aria-disabled={!hasMore}
          >
            Next
          </Button>
        </Cluster>
      )}
    </Stack>
  );
}
