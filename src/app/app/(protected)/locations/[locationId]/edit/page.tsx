import { notFound } from "next/navigation";
import { Heading, Text, Label } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { getLocation } from "@/lib/services/locations";
import { AppError } from "@/lib/errors";
import { updateLocationAction } from "../../actions";

export default async function EditLocationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locationId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locationId } = await params;
  const { error } = await searchParams;

  let location;
  try {
    location = await getLocation(locationId);
  } catch (err) {
    if (err instanceof AppError && err.code === "not_found") notFound();
    throw err;
  }

  const updateAction = updateLocationAction.bind(null, locationId);

  return (
    <Stack className="mx-auto max-w-xl gap-6">
      <Stack className="gap-1">
        <Heading as="h1">Edit location</Heading>
        <Text className="text-muted">{location.name}</Text>
      </Stack>

      {error && <Alert title="Could not update location" description={error} />}

      <form action={updateAction} className="flex flex-col gap-4">
        <Stack className="gap-1">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required maxLength={200} defaultValue={location.name} />
        </Stack>
        <Stack className="gap-1">
          <Label htmlFor="addressLine1">Address line 1</Label>
          <Input
            id="addressLine1"
            name="addressLine1"
            maxLength={200}
            defaultValue={location.address_line1 ?? ""}
          />
        </Stack>
        <Stack className="gap-1">
          <Label htmlFor="addressLine2">Address line 2</Label>
          <Input
            id="addressLine2"
            name="addressLine2"
            maxLength={200}
            defaultValue={location.address_line2 ?? ""}
          />
        </Stack>
        <Cluster className="gap-4">
          <Stack className="min-w-40 flex-1 gap-1">
            <Label htmlFor="city">City</Label>
            <Input id="city" name="city" maxLength={100} defaultValue={location.city ?? ""} />
          </Stack>
          <Stack className="min-w-40 flex-1 gap-1">
            <Label htmlFor="region">Region / State</Label>
            <Input id="region" name="region" maxLength={100} defaultValue={location.region ?? ""} />
          </Stack>
        </Cluster>
        <Cluster className="gap-4">
          <Stack className="min-w-40 flex-1 gap-1">
            <Label htmlFor="postalCode">Postal code</Label>
            <Input
              id="postalCode"
              name="postalCode"
              maxLength={30}
              defaultValue={location.postal_code ?? ""}
            />
          </Stack>
          <Stack className="min-w-40 flex-1 gap-1">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              name="country"
              maxLength={100}
              defaultValue={location.country ?? ""}
            />
          </Stack>
        </Cluster>
        <Stack className="gap-1">
          <Label htmlFor="timezone">Time zone</Label>
          <Input
            id="timezone"
            name="timezone"
            maxLength={100}
            defaultValue={location.timezone ?? ""}
          />
        </Stack>
        <Cluster className="justify-end gap-3">
          <Button href={`/app/locations/${location.id}`} variant="secondary">
            Cancel
          </Button>
          <Button type="submit">Save changes</Button>
        </Cluster>
      </form>
    </Stack>
  );
}
