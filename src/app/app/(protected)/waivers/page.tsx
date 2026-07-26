import Link from "next/link";
import { Heading, Text } from "@/components/ui/Typography";
import { Stack, Cluster, ScrollArea } from "@/components/ui/Layout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { listWaivers } from "@/lib/services/waivers";
import { AppError } from "@/lib/errors";
import type { WaiverStatus } from "@/lib/db/database.types";

function statusBadgeStatus(status: WaiverStatus): "success" | "warning" | "danger" | "neutral" {
  if (status === "active" || status === "renewed") return "success";
  if (status === "rejected" || status === "revoked" || status === "expired") return "danger";
  return "warning";
}

/** Waiver queue — expiring-soon is a filtered view of this same list rather than a separate dashboard route. */
export default async function WaiversPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; expiring?: string }>;
}) {
  const { status, expiring } = await searchParams;

  let waivers: Awaited<ReturnType<typeof listWaivers>> = [];
  let loadError: string | null = null;
  try {
    waivers = await listWaivers({
      status: status as WaiverStatus | undefined,
      expiringOnly: expiring === "true",
    });
  } catch (error) {
    loadError = error instanceof AppError ? error.message : "Could not load waivers.";
  }

  return (
    <Stack className="mx-auto max-w-4xl gap-6">
      <Stack className="gap-1">
        <Heading as="h1">Temporary waivers</Heading>
        <Text className="text-muted">Time-bound risk acceptances against open exceptions.</Text>
      </Stack>

      <Cluster className="gap-2 text-sm">
        <Link href={{ pathname: "/app/waivers" }} className="text-cobalt">
          All
        </Link>
        <Link
          href={{ pathname: "/app/waivers", query: { status: "requested" } }}
          className="text-cobalt"
        >
          Pending approval
        </Link>
        <Link
          href={{ pathname: "/app/waivers", query: { expiring: "true" } }}
          className="text-cobalt"
        >
          Expiring soon
        </Link>
      </Cluster>

      {loadError && <Alert title="Could not load waivers" description={loadError} />}
      {!loadError && waivers.length === 0 && (
        <Alert title="No waivers match this view" description="Nothing here right now." />
      )}

      {!loadError && waivers.length > 0 && (
        <ScrollArea>
          <table className="w-full min-w-[520px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 pr-4 font-medium">Justification</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Expires</th>
              </tr>
            </thead>
            <tbody>
              {waivers.map((waiver) => (
                <tr key={waiver.id} className="border-b border-border/60">
                  <td className="py-3 pr-4 font-medium">
                    <a href={`/app/waivers/${waiver.id}`} className="text-cobalt">
                      {waiver.business_justification}
                    </a>
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={statusBadgeStatus(waiver.status)}>
                      {waiver.status}
                    </StatusBadge>
                  </td>
                  <td className="py-3 pr-4 text-muted">
                    {new Date(waiver.expires_at).toLocaleDateString()}
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
