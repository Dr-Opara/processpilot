import { Heading, Text, Label } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { createLocationAction } from "../actions";

export default async function NewLocationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <Stack className="mx-auto max-w-xl gap-6">
      <Stack className="gap-1">
        <Heading as="h1">Add a location</Heading>
        <Text className="text-muted">Locations represent a physical or regional site.</Text>
      </Stack>

      {error && <Alert title="Could not create location" description={error} />}

      <form action={createLocationAction} className="flex flex-col gap-4">
        <Stack className="gap-1">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required maxLength={200} autoFocus />
        </Stack>
        <Stack className="gap-1">
          <Label htmlFor="addressLine1">Address line 1</Label>
          <Input id="addressLine1" name="addressLine1" maxLength={200} />
        </Stack>
        <Stack className="gap-1">
          <Label htmlFor="addressLine2">Address line 2</Label>
          <Input id="addressLine2" name="addressLine2" maxLength={200} />
        </Stack>
        <Cluster className="gap-4">
          <Stack className="min-w-40 flex-1 gap-1">
            <Label htmlFor="city">City</Label>
            <Input id="city" name="city" maxLength={100} />
          </Stack>
          <Stack className="min-w-40 flex-1 gap-1">
            <Label htmlFor="region">Region / State</Label>
            <Input id="region" name="region" maxLength={100} />
          </Stack>
        </Cluster>
        <Cluster className="gap-4">
          <Stack className="min-w-40 flex-1 gap-1">
            <Label htmlFor="postalCode">Postal code</Label>
            <Input id="postalCode" name="postalCode" maxLength={30} />
          </Stack>
          <Stack className="min-w-40 flex-1 gap-1">
            <Label htmlFor="country">Country</Label>
            <Input id="country" name="country" maxLength={100} />
          </Stack>
        </Cluster>
        <Stack className="gap-1">
          <Label htmlFor="timezone">Time zone</Label>
          <Input id="timezone" name="timezone" placeholder="e.g. America/Chicago" maxLength={100} />
        </Stack>
        <Cluster className="justify-end gap-3">
          <Button href="/app/locations" variant="secondary">
            Cancel
          </Button>
          <Button type="submit">Save location</Button>
        </Cluster>
      </form>
    </Stack>
  );
}
