import Link from "next/link";
import { Heading, Text } from "@/components/ui/Typography";
import { Stack, Cluster, ScrollArea } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { listExceptions } from "@/lib/services/exceptions";
import { AppError } from "@/lib/errors";
import type { ExceptionSeverity, ExceptionStatus } from "@/lib/db/database.types";

function severityBadgeStatus(
  severity: ExceptionSeverity,
): "success" | "warning" | "danger" | "neutral" {
  if (severity === "critical" || severity === "high") return "danger";
  if (severity === "moderate") return "warning";
  return "neutral";
}

function statusBadgeStatus(status: ExceptionStatus): "success" | "warning" | "danger" | "neutral" {
  if (status === "closed") return "success";
  if (status === "rejected") return "danger";
  if (status === "reported") return "neutral";
  return "warning";
}

/**
 * The exception queue — also this phase's "dashboard" (open/overdue/
 * high-and-critical/by-type views are query-param-driven filters over
 * this same list, rather than separate dashboard route files) per this
 * phase's consolidated route scope — see
 * docs/architecture/exception-management.md's "Routes" section for why.
 */
export default async function ExceptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; severity?: string; overdue?: string }>;
}) {
  const { status, severity, overdue } = await searchParams;

  let exceptions: Awaited<ReturnType<typeof listExceptions>> = [];
  let loadError: string | null = null;
  try {
    exceptions = await listExceptions({
      status: status as ExceptionStatus | undefined,
      severity: severity as ExceptionSeverity | undefined,
      overdueOnly: overdue === "true",
    });
  } catch (error) {
    loadError = error instanceof AppError ? error.message : "Could not load exceptions.";
  }

  return (
    <Stack className="mx-auto max-w-5xl gap-6">
      <Cluster className="justify-between">
        <Stack className="gap-1">
          <Heading as="h1">Exceptions</Heading>
          <Text className="text-muted">
            Deviations flagged for triage, investigation, and corrective action.
          </Text>
        </Stack>
        <Button href="/app/exceptions/new">Report an exception</Button>
      </Cluster>

      <Cluster className="gap-2 text-sm">
        <Link href={{ pathname: "/app/exceptions" }} className="text-cobalt">
          All
        </Link>
        <Link
          href={{ pathname: "/app/exceptions", query: { status: "reported" } }}
          className="text-cobalt"
        >
          Reported
        </Link>
        <Link
          href={{ pathname: "/app/exceptions", query: { severity: "critical" } }}
          className="text-cobalt"
        >
          Critical
        </Link>
        <Link
          href={{ pathname: "/app/exceptions", query: { overdue: "true" } }}
          className="text-cobalt"
        >
          Overdue
        </Link>
      </Cluster>

      {loadError && <Alert title="Could not load exceptions" description={loadError} />}
      {!loadError && exceptions.length === 0 && (
        <Alert title="No exceptions match this view" description="Nothing to triage right now." />
      )}

      {!loadError && exceptions.length > 0 && (
        <ScrollArea>
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 pr-4 font-medium">Title</th>
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 pr-4 font-medium">Severity</th>
                <th className="py-2 pr-4 font-medium">Priority</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Reported</th>
              </tr>
            </thead>
            <tbody>
              {exceptions.map((exception) => (
                <tr key={exception.id} className="border-b border-border/60">
                  <td className="py-3 pr-4 font-medium">
                    <a href={`/app/exceptions/${exception.id}`} className="text-cobalt">
                      {exception.title}
                    </a>
                  </td>
                  <td className="py-3 pr-4">{exception.exception_type.replace(/_/g, " ")}</td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={severityBadgeStatus(exception.severity)}>
                      {exception.severity}
                    </StatusBadge>
                  </td>
                  <td className="py-3 pr-4">{exception.priority ?? "—"}</td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={statusBadgeStatus(exception.status)}>
                      {exception.status.replace(/_/g, " ")}
                    </StatusBadge>
                  </td>
                  <td className="py-3 pr-4 text-muted">
                    {new Date(exception.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      )}
    </Stack>
  );
}
