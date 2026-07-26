import Link from "next/link";
import { Heading, Text } from "@/components/ui/Typography";
import { Stack, Cluster, ScrollArea } from "@/components/ui/Layout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { listCapaPlans } from "@/lib/services/capa";
import { AppError } from "@/lib/errors";
import type { CapaPlanStatus } from "@/lib/db/database.types";

function statusBadgeStatus(status: CapaPlanStatus): "success" | "warning" | "danger" | "neutral" {
  if (status === "closed" || status === "effective") return "success";
  if (status === "ineffective" || status === "canceled") return "danger";
  return "warning";
}

/** CAPA queue — also this phase's CAPA dashboard (status-filtered views, e.g. ?status=pending_verification for overdue/ineffective triage, rather than a separate dashboard route). */
export default async function CapaPlansPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;

  let plans: Awaited<ReturnType<typeof listCapaPlans>> = [];
  let loadError: string | null = null;
  try {
    plans = await listCapaPlans({ status: status as CapaPlanStatus | undefined });
  } catch (error) {
    loadError = error instanceof AppError ? error.message : "Could not load CAPA plans.";
  }

  return (
    <Stack className="mx-auto max-w-4xl gap-6">
      <Stack className="gap-1">
        <Heading as="h1">Corrective and preventive actions</Heading>
        <Text className="text-muted">CAPA plans in progress across every exception.</Text>
      </Stack>

      <Cluster className="gap-2 text-sm">
        <Link href={{ pathname: "/app/capa" }} className="text-cobalt">
          All
        </Link>
        <Link
          href={{ pathname: "/app/capa", query: { status: "pending_approval" } }}
          className="text-cobalt"
        >
          Pending approval
        </Link>
        <Link
          href={{ pathname: "/app/capa", query: { status: "pending_verification" } }}
          className="text-cobalt"
        >
          Pending verification
        </Link>
        <Link
          href={{ pathname: "/app/capa", query: { status: "ineffective" } }}
          className="text-cobalt"
        >
          Ineffective
        </Link>
      </Cluster>

      {loadError && <Alert title="Could not load CAPA plans" description={loadError} />}
      {!loadError && plans.length === 0 && (
        <Alert title="No CAPA plans match this view" description="Nothing here right now." />
      )}

      {!loadError && plans.length > 0 && (
        <ScrollArea>
          <table className="w-full min-w-[520px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 pr-4 font-medium">Title</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id} className="border-b border-border/60">
                  <td className="py-3 pr-4 font-medium">
                    <a href={`/app/capa/${plan.id}`} className="text-cobalt">
                      {plan.title}
                    </a>
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={statusBadgeStatus(plan.status)}>
                      {plan.status.replace(/_/g, " ")}
                    </StatusBadge>
                  </td>
                  <td className="py-3 pr-4 text-muted">
                    {new Date(plan.created_at).toLocaleDateString()}
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
