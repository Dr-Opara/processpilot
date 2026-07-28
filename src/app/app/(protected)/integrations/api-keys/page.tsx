import Link from "next/link";
import { Heading, Text } from "@/components/ui/Typography";
import { Stack, Cluster, ScrollArea } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/ui/Alert";
import { API_KEY_SCOPES, listApiKeys, listApiUsage } from "@/lib/services/api-keys";
import { AppError } from "@/lib/errors";
import { createApiKeyAction, revokeApiKeyAction } from "./actions";

export default async function ApiKeysPage({
  searchParams,
}: {
  searchParams: Promise<{ newKey?: string; error?: string }>;
}) {
  const { newKey, error } = await searchParams;

  let keys: Awaited<ReturnType<typeof listApiKeys>> = [];
  let usage: Awaited<ReturnType<typeof listApiUsage>> = [];
  let loadError: string | null = null;
  try {
    [keys, usage] = await Promise.all([listApiKeys(), listApiUsage(20)]);
  } catch (err) {
    loadError = err instanceof AppError ? err.message : "Could not load API keys.";
  }

  return (
    <Stack className="mx-auto max-w-3xl gap-8">
      <Stack className="gap-1">
        <Link href={{ pathname: "/app/integrations" }} className="text-sm text-cobalt">
          ← Integrations
        </Link>
        <Heading as="h1">API keys</Heading>
        <Text className="text-muted">
          Organization-scoped keys for ProcessPilot&apos;s public API — see
          docs/architecture/public-api.md.
        </Text>
      </Stack>

      {newKey && <Alert title="Copy this key now — it won't be shown again" description={newKey} />}
      {(error || loadError) && (
        <Alert title="Could not complete that action" description={error ?? loadError ?? ""} />
      )}

      {!loadError && (
        <Stack className="gap-3 rounded-md border border-border p-4">
          <Heading as="h2">Create a key</Heading>
          <form action={createApiKeyAction} className="grid gap-3">
            <Stack className="gap-1">
              <label htmlFor="name" className="text-xs font-medium text-muted">
                Name
              </label>
              <input
                id="name"
                name="name"
                required
                placeholder="CI integration"
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink shadow-sm outline-none focus:border-cobalt focus:ring-2 focus:ring-cobalt/20"
              />
            </Stack>
            <Stack className="gap-1">
              <Text className="text-xs font-medium text-muted">Scopes</Text>
              <Cluster className="gap-3">
                {API_KEY_SCOPES.map((scope) => (
                  <label key={scope} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="scopes" value={scope} />
                    {scope}
                  </label>
                ))}
              </Cluster>
            </Stack>
            <Button type="submit" variant="secondary" className="self-start">
              Create key
            </Button>
          </form>
        </Stack>
      )}

      {!loadError && (
        <Stack className="gap-3">
          <Heading as="h2">Keys</Heading>
          {keys.length === 0 ? (
            <Text className="text-sm text-muted">No API keys yet.</Text>
          ) : (
            <Stack className="gap-2">
              {keys.map((key) => (
                <Cluster
                  key={key.id}
                  className="justify-between gap-2 rounded-md border border-border p-3"
                >
                  <Stack className="gap-0">
                    <Cluster className="items-center gap-2">
                      <Text className="font-semibold">{key.name}</Text>
                      <StatusBadge status={key.status === "active" ? "success" : "neutral"}>
                        {key.status}
                      </StatusBadge>
                    </Cluster>
                    <Text className="text-xs text-muted">
                      {key.key_prefix}… · {key.scopes.join(", ")}
                    </Text>
                  </Stack>
                  {key.status === "active" && (
                    <form action={revokeApiKeyAction.bind(null, key.id)}>
                      <Button type="submit" variant="quiet">
                        Revoke
                      </Button>
                    </form>
                  )}
                </Cluster>
              ))}
            </Stack>
          )}
        </Stack>
      )}

      {!loadError && usage.length > 0 && (
        <Stack className="gap-3">
          <Heading as="h2">Recent API usage</Heading>
          <ScrollArea>
            <table className="w-full min-w-[480px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2 pr-4 font-medium">Time</th>
                  <th className="py-2 pr-4 font-medium">Method</th>
                  <th className="py-2 pr-4 font-medium">Path</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {usage.map((entry, index) => (
                  <tr key={index} className="border-b border-border/60">
                    <td className="py-2 pr-4 text-muted">
                      {new Date(entry.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4">{entry.method}</td>
                    <td className="py-2 pr-4">{entry.path}</td>
                    <td className="py-2 pr-4">{entry.status_code}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        </Stack>
      )}
    </Stack>
  );
}
