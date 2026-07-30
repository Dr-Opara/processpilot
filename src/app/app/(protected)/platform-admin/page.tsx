import Link from "next/link";
import { Heading, Text } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { getPlatformHealthOverview } from "@/lib/services/platform-admin";
import { AppError } from "@/lib/errors";

export default async function PlatformAdminDashboardPage() {
  let overview: Awaited<ReturnType<typeof getPlatformHealthOverview>> | null = null;
  let loadError: string | null = null;
  try {
    overview = await getPlatformHealthOverview();
  } catch (err) {
    loadError = err instanceof AppError ? err.message : "Could not load platform health.";
  }

  return (
    <Stack className="mx-auto max-w-4xl gap-8">
      <Stack className="gap-1">
        <Heading as="h1">Platform administration</Heading>
        <Text className="text-muted">
          Cross-tenant operational visibility — separate from any organization&apos;s own admin
          surface.
        </Text>
      </Stack>

      {loadError && <Alert title="Access denied" description={loadError} />}

      {overview && (
        <>
          <Cluster className="gap-2 text-sm">
            <Link href="/app/platform-admin/organizations" className="text-cobalt">
              Organizations
            </Link>
            <Link href="/app/platform-admin/users" className="text-cobalt">
              User lookup
            </Link>
            <Link href="/app/platform-admin/audit-log" className="text-cobalt">
              Audit log
            </Link>
          </Cluster>

          <Stack className="gap-4 rounded-md border border-border p-4">
            <Heading as="h2" className="text-lg">
              System health
            </Heading>
            <Cluster className="justify-between">
              <Text>Active organizations</Text>
              <Text className="text-muted">{overview.organizationCount}</Text>
            </Cluster>
            <Cluster className="justify-between">
              <Text>Active suspensions</Text>
              <Text className="text-muted">{overview.activeSuspensionCount}</Text>
            </Cluster>
            <Cluster className="justify-between">
              <Text>Queue — pending jobs</Text>
              <Text className="text-muted">{overview.queue.pendingCount}</Text>
            </Cluster>
            <Cluster className="justify-between">
              <Text>Queue — dead-lettered (24h)</Text>
              <Text className="text-muted">{overview.queue.deadLetterCountLast24h}</Text>
            </Cluster>
            <Cluster className="justify-between">
              <Text>Deployment version</Text>
              <Text className="font-mono text-muted">{overview.deploymentVersion}</Text>
            </Cluster>
          </Stack>

          <Stack className="gap-3 rounded-md border border-border p-4">
            <Heading as="h2" className="text-lg">
              Provider configuration
            </Heading>
            <div className="grid gap-2 sm:grid-cols-2">
              {overview.providers.map((provider) => (
                <Cluster key={provider.name} className="justify-between">
                  <Text className="capitalize">{provider.name.replace(/_/g, " ")}</Text>
                  <StatusBadge status={provider.status === "ok" ? "success" : "neutral"}>
                    {provider.status === "ok" ? "Configured" : "Not configured"}
                  </StatusBadge>
                </Cluster>
              ))}
            </div>
          </Stack>
        </>
      )}
    </Stack>
  );
}
