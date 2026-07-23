import { notFound } from "next/navigation";
import { Heading, Text } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getLocation } from "@/lib/services/locations";
import { AppError } from "@/lib/errors";
import { archiveLocationAction, restoreLocationAction } from "../actions";

export default async function LocationDetailPage({
  params,
}: {
  params: Promise<{ locationId: string }>;
}) {
  const { locationId } = await params;

  let location;
  try {
    location = await getLocation(locationId);
  } catch (error) {
    if (error instanceof AppError && error.code === "not_found") notFound();
    throw error;
  }

  return (
    <Stack className="mx-auto max-w-2xl gap-6">
      <Cluster className="justify-between">
        <Stack className="gap-1">
          <Cluster className="gap-3">
            <Heading as="h1">{location.name}</Heading>
            <StatusBadge status={location.archived_at ? "neutral" : "success"}>
              {location.archived_at ? "Archived" : "Active"}
            </StatusBadge>
          </Cluster>
          <Text className="text-muted">
            {[location.city, location.region, location.country].filter(Boolean).join(", ") || "No address on file"}
          </Text>
        </Stack>
        <Cluster className="gap-2">
          <Button href={`/app/locations/${location.id}/edit`} variant="secondary">
            Edit
          </Button>
          {location.archived_at ? (
            <form action={restoreLocationAction.bind(null, location.id)}>
              <Button type="submit" variant="secondary">
                Restore
              </Button>
            </form>
          ) : (
            <form action={archiveLocationAction.bind(null, location.id)}>
              <Button type="submit" variant="secondary">
                Archive
              </Button>
            </form>
          )}
        </Cluster>
      </Cluster>

      <dl className="grid grid-cols-2 gap-4 rounded-2xl border border-border bg-surface p-6 text-sm">
        <div>
          <dt className="text-muted">Address line 1</dt>
          <dd className="text-ink">{location.address_line1 ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Address line 2</dt>
          <dd className="text-ink">{location.address_line2 ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Postal code</dt>
          <dd className="text-ink">{location.postal_code ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">Time zone</dt>
          <dd className="text-ink">{location.timezone ?? "—"}</dd>
        </div>
      </dl>
    </Stack>
  );
}
