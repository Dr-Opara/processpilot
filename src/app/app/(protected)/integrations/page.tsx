import Link from "next/link";
import { Heading, Text } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { listIntegrations } from "@/lib/services/integration-connections";
import { AppError } from "@/lib/errors";
import type { IntegrationConnectionStatus } from "@/lib/db/database.types";
import {
  connectApiKeyAction,
  connectOAuthAction,
  disconnectIntegrationAction,
  verifyIntegrationAction,
} from "./actions";

function statusBadgeStatus(
  status: IntegrationConnectionStatus,
): "success" | "warning" | "danger" | "neutral" {
  if (status === "connected") return "success";
  if (status === "error") return "danger";
  if (status === "degraded") return "warning";
  return "neutral";
}

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string }>;
}) {
  const { error, connected } = await searchParams;

  let catalog: Awaited<ReturnType<typeof listIntegrations>> = [];
  let loadError: string | null = null;
  try {
    catalog = await listIntegrations();
  } catch (err) {
    loadError = err instanceof AppError ? err.message : "Could not load integrations.";
  }

  return (
    <Stack className="mx-auto max-w-3xl gap-8">
      <Cluster className="justify-between">
        <Stack className="gap-1">
          <Heading as="h1">Integrations</Heading>
          <Text className="text-muted">Connect third-party tools to this organization.</Text>
        </Stack>
        <Cluster className="gap-2 text-sm">
          <Link href={{ pathname: "/app/integrations/api-keys" }} className="text-cobalt">
            API keys
          </Link>
          <Link href={{ pathname: "/app/integrations/webhooks" }} className="text-cobalt">
            Webhooks
          </Link>
          <Link href={{ pathname: "/app/integrations/scim" }} className="text-cobalt">
            SCIM
          </Link>
        </Cluster>
      </Cluster>

      {connected === "true" && (
        <Alert title="Connected" description="The integration was connected successfully." />
      )}
      {(error || loadError) && (
        <Alert title="Could not complete that action" description={error ?? loadError ?? ""} />
      )}

      {!loadError && (
        <Stack className="gap-3">
          {catalog.map((entry) => (
            <Stack key={entry.provider} className="gap-2 rounded-md border border-border p-4">
              <Cluster className="justify-between">
                <Stack className="gap-0">
                  <Text className="font-semibold">{entry.displayName}</Text>
                  <Text className="text-sm text-muted">{entry.description}</Text>
                </Stack>
                {entry.connection && (
                  <StatusBadge status={statusBadgeStatus(entry.connection.status)}>
                    {entry.connection.status}
                  </StatusBadge>
                )}
              </Cluster>
              {entry.connection?.external_account_label && (
                <Text className="text-xs text-muted">
                  {entry.connection.external_account_label}
                </Text>
              )}
              {entry.connection?.last_error && (
                <Text className="text-xs text-danger">{entry.connection.last_error}</Text>
              )}

              {!entry.implemented && (
                <Text className="text-xs text-muted">
                  Not yet available to connect — coming soon.
                </Text>
              )}

              {entry.implemented && !entry.connection && entry.authType === "oauth2" && (
                <form action={connectOAuthAction}>
                  <input type="hidden" name="provider" value={entry.provider} />
                  <Button type="submit" variant="secondary">
                    Connect
                  </Button>
                </form>
              )}

              {entry.implemented && !entry.connection && entry.authType === "api_key" && (
                <form action={connectApiKeyAction} className="flex items-end gap-2">
                  <input type="hidden" name="provider" value={entry.provider} />
                  <input
                    name="apiKey"
                    type="password"
                    placeholder="API key"
                    className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink shadow-sm outline-none focus:border-cobalt focus:ring-2 focus:ring-cobalt/20"
                  />
                  <Button type="submit" variant="secondary">
                    Connect
                  </Button>
                </form>
              )}

              {entry.connection && entry.connection.status !== "disconnected" && (
                <Cluster className="gap-2">
                  <form action={verifyIntegrationAction.bind(null, entry.provider)}>
                    <Button type="submit" variant="quiet">
                      Check connection
                    </Button>
                  </form>
                  <form action={disconnectIntegrationAction.bind(null, entry.provider)}>
                    <Button type="submit" variant="quiet">
                      Disconnect
                    </Button>
                  </form>
                </Cluster>
              )}
            </Stack>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
