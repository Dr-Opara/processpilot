import Link from "next/link";
import { Heading, Text } from "@/components/ui/Typography";
import { Stack, Cluster, ScrollArea } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import {
  WEBHOOK_EVENT_TYPES,
  listWebhookDeliveries,
  listWebhookSubscriptions,
} from "@/lib/services/webhooks";
import { AppError } from "@/lib/errors";
import type { WebhookDeliveryStatus } from "@/lib/db/database.types";
import {
  createWebhookSubscriptionAction,
  deleteWebhookSubscriptionAction,
  replayWebhookDeliveryAction,
  toggleWebhookSubscriptionAction,
} from "./actions";

function deliveryStatusBadge(
  status: WebhookDeliveryStatus,
): "success" | "warning" | "danger" | "neutral" {
  if (status === "delivered") return "success";
  if (status === "dead_letter") return "danger";
  if (status === "failed") return "warning";
  return "neutral";
}

export default async function WebhooksPage({
  searchParams,
}: {
  searchParams: Promise<{ newSecret?: string; error?: string }>;
}) {
  const { newSecret, error } = await searchParams;

  let subscriptions: Awaited<ReturnType<typeof listWebhookSubscriptions>> = [];
  let deliveries: Awaited<ReturnType<typeof listWebhookDeliveries>> = [];
  let loadError: string | null = null;
  try {
    [subscriptions, deliveries] = await Promise.all([
      listWebhookSubscriptions(),
      listWebhookDeliveries(),
    ]);
  } catch (err) {
    loadError = err instanceof AppError ? err.message : "Could not load webhooks.";
  }

  return (
    <Stack className="mx-auto max-w-3xl gap-8">
      <Stack className="gap-1">
        <Link href={{ pathname: "/app/integrations" }} className="text-sm text-cobalt">
          ← Integrations
        </Link>
        <Heading as="h1">Webhooks</Heading>
        <Text className="text-muted">
          Send signed HTTP notifications to your own endpoint when ProcessPilot events happen.
        </Text>
      </Stack>

      {newSecret && (
        <Alert
          title="Copy this signing secret now — it won't be shown again"
          description={newSecret}
        />
      )}
      {(error || loadError) && (
        <Alert title="Could not complete that action" description={error ?? loadError ?? ""} />
      )}

      {!loadError && (
        <Stack className="gap-3 rounded-md border border-border p-4">
          <Heading as="h2">Add a subscription</Heading>
          <form action={createWebhookSubscriptionAction} className="grid gap-3">
            <Stack className="gap-1">
              <label htmlFor="targetUrl" className="text-xs font-medium text-muted">
                Target URL (https only)
              </label>
              <input
                id="targetUrl"
                name="targetUrl"
                required
                placeholder="https://example.com/webhooks/processpilot"
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink shadow-sm outline-none focus:border-cobalt focus:ring-2 focus:ring-cobalt/20"
              />
            </Stack>
            <Stack className="gap-1">
              <Text className="text-xs font-medium text-muted">Event types</Text>
              <Cluster className="flex-wrap gap-3">
                {WEBHOOK_EVENT_TYPES.map((eventType) => (
                  <label key={eventType} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="eventTypes" value={eventType} />
                    {eventType}
                  </label>
                ))}
              </Cluster>
            </Stack>
            <Button type="submit" variant="secondary" className="self-start">
              Add subscription
            </Button>
          </form>
        </Stack>
      )}

      {!loadError && (
        <Stack className="gap-3">
          <Heading as="h2">Subscriptions</Heading>
          {subscriptions.length === 0 ? (
            <Text className="text-sm text-muted">No webhook subscriptions yet.</Text>
          ) : (
            <Stack className="gap-2">
              {subscriptions.map((subscription) => (
                <Stack key={subscription.id} className="gap-2 rounded-md border border-border p-3">
                  <Cluster className="justify-between">
                    <Cluster className="items-center gap-2">
                      <Text className="font-mono text-sm">{subscription.target_url}</Text>
                      <StatusBadge
                        status={subscription.status === "active" ? "success" : "neutral"}
                      >
                        {subscription.status}
                      </StatusBadge>
                    </Cluster>
                  </Cluster>
                  <Text className="text-xs text-muted">{subscription.event_types.join(", ")}</Text>
                  <Cluster className="gap-2">
                    <form
                      action={toggleWebhookSubscriptionAction.bind(
                        null,
                        subscription.id,
                        subscription.status === "active" ? "disabled" : "active",
                      )}
                    >
                      <Button type="submit" variant="quiet">
                        {subscription.status === "active" ? "Disable" : "Enable"}
                      </Button>
                    </form>
                    <form action={deleteWebhookSubscriptionAction.bind(null, subscription.id)}>
                      <Button type="submit" variant="quiet">
                        Delete
                      </Button>
                    </form>
                  </Cluster>
                </Stack>
              ))}
            </Stack>
          )}
        </Stack>
      )}

      {!loadError && (
        <Stack className="gap-3">
          <Heading as="h2">Recent deliveries</Heading>
          {deliveries.length === 0 ? (
            <Text className="text-sm text-muted">No deliveries yet.</Text>
          ) : (
            <ScrollArea>
              <table className="w-full min-w-[600px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted">
                    <th className="py-2 pr-4 font-medium">Time</th>
                    <th className="py-2 pr-4 font-medium">Event</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Attempts</th>
                    <th className="py-2 pr-4 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((delivery) => (
                    <tr key={delivery.id} className="border-b border-border/60">
                      <td className="py-2 pr-4 text-muted">
                        {new Date(delivery.created_at).toLocaleString()}
                      </td>
                      <td className="py-2 pr-4">{delivery.event_type}</td>
                      <td className="py-2 pr-4">
                        <StatusBadge status={deliveryStatusBadge(delivery.status)}>
                          {delivery.status.replace(/_/g, " ")}
                        </StatusBadge>
                      </td>
                      <td className="py-2 pr-4">{delivery.attempt_count}</td>
                      <td className="py-2 pr-4">
                        {(delivery.status === "failed" || delivery.status === "dead_letter") && (
                          <form action={replayWebhookDeliveryAction.bind(null, delivery.id)}>
                            <Button type="submit" variant="quiet">
                              Replay
                            </Button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </Stack>
      )}
    </Stack>
  );
}
