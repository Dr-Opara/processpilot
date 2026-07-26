import { Heading, Text, Label } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import { listBusinessCalendars } from "@/lib/services/sla-config";
import { createSlaDefinitionAction } from "../../actions";

export default async function NewSlaDefinitionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const calendars = await listBusinessCalendars().catch(() => []);

  return (
    <Stack className="mx-auto max-w-2xl gap-6">
      <Stack className="gap-1">
        <Heading as="h1">Add SLA definition</Heading>
        <Text className="text-muted">
          A reusable target time, optionally against a business calendar.
        </Text>
      </Stack>

      {error && <Alert title="Could not save SLA definition" description={error} />}

      <form action={createSlaDefinitionAction} className="flex flex-col gap-4">
        <Stack className="gap-1">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required maxLength={300} autoFocus />
        </Stack>
        <Stack className="gap-1">
          <Label htmlFor="targetType">Applies to</Label>
          <Select id="targetType" name="targetType" defaultValue="task" className="w-48">
            <option value="task">Task</option>
            <option value="approval">Approval</option>
            <option value="workflow">Workflow</option>
          </Select>
        </Stack>
        <Stack className="gap-1">
          <Label htmlFor="targetMinutes">Target (minutes)</Label>
          <Input id="targetMinutes" name="targetMinutes" type="number" min={1} required />
        </Stack>
        <Stack className="gap-1">
          <Label htmlFor="businessCalendarId">
            Business calendar (optional — 24/7 clock if unset)
          </Label>
          <Select
            id="businessCalendarId"
            name="businessCalendarId"
            defaultValue=""
            className="w-64"
          >
            <option value="">None (24/7)</option>
            {calendars.map((calendar) => (
              <option key={calendar.id} value={calendar.id}>
                {calendar.name}
              </option>
            ))}
          </Select>
        </Stack>
        <Stack className="gap-1">
          <Label htmlFor="reminderMinutesBeforeDue">
            Reminders (minutes before due, comma-separated)
          </Label>
          <Input
            id="reminderMinutesBeforeDue"
            name="reminderMinutesBeforeDue"
            placeholder="60,15"
          />
        </Stack>

        <Cluster className="justify-end gap-3">
          <Button href="/app/sla/definitions" variant="secondary">
            Cancel
          </Button>
          <Button type="submit">Save</Button>
        </Cluster>
      </form>
    </Stack>
  );
}
