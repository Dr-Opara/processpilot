import Link from "next/link";
import { Heading, Text } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Alert } from "@/components/ui/Alert";
import { listPlatformAdminAuditLog } from "@/lib/services/platform-admin";
import { AppError } from "@/lib/errors";

export default async function PlatformAdminAuditLogPage() {
  let events: Awaited<ReturnType<typeof listPlatformAdminAuditLog>> = [];
  let loadError: string | null = null;
  try {
    events = await listPlatformAdminAuditLog();
  } catch (err) {
    loadError = err instanceof AppError ? err.message : "Could not load the audit log.";
  }

  return (
    <Stack className="mx-auto max-w-3xl gap-6">
      <Stack className="gap-1">
        <Link href="/app/platform-admin" className="text-sm text-cobalt">
          ← Platform administration
        </Link>
        <Heading as="h1">Platform admin audit log</Heading>
        <Text className="text-muted">
          Every cross-tenant platform-admin action — separate from any single organization&apos;s
          own audit trail.
        </Text>
      </Stack>

      {loadError && <Alert title="Access denied" description={loadError} />}

      {!loadError && (
        <Stack className="gap-2">
          {events.length === 0 ? (
            <Text className="text-sm text-muted">No platform-admin actions recorded yet.</Text>
          ) : (
            events.map((event) => (
              <Cluster key={event.id} className="justify-between border-b border-border/60 pb-2">
                <Stack className="gap-0.5">
                  <Text>{event.action}</Text>
                  {event.reason && <Text className="text-xs text-muted">{event.reason}</Text>}
                </Stack>
                <Text className="text-xs text-muted">
                  {new Date(event.created_at).toLocaleString()}
                </Text>
              </Cluster>
            ))
          )}
        </Stack>
      )}
    </Stack>
  );
}
