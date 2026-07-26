import { Heading, Text, Label } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Alert } from "@/components/ui/Alert";
import { listBusinessCalendars } from "@/lib/services/sla-config";
import { AppError } from "@/lib/errors";
import { addBusinessCalendarHolidayAction, createBusinessCalendarAction } from "../actions";

const WEEKDAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

export default async function BusinessCalendarsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  let calendars: Awaited<ReturnType<typeof listBusinessCalendars>> = [];
  let loadError: string | null = null;
  try {
    calendars = await listBusinessCalendars();
  } catch (err) {
    loadError = err instanceof AppError ? err.message : "Could not load business calendars.";
  }

  return (
    <Stack className="mx-auto max-w-3xl gap-8">
      <Stack className="gap-1">
        <Heading as="h1">Business calendars</Heading>
        <Text className="text-muted">
          Time zone, work-hours, and holiday definitions used to compute business-hour-aware due
          dates.
        </Text>
      </Stack>

      {error && <Alert title="Could not save" description={error} />}
      {loadError && <Alert title="Could not load calendars" description={loadError} />}

      <Stack className="gap-3 rounded-md border border-border p-4">
        <Heading as="h2">Add calendar</Heading>
        <form action={createBusinessCalendarAction} className="flex flex-col gap-3">
          <Stack className="gap-1">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" required maxLength={300} />
          </Stack>
          <Stack className="gap-1">
            <Label htmlFor="timezone">Time zone (IANA)</Label>
            <Input
              id="timezone"
              name="timezone"
              defaultValue="UTC"
              required
              placeholder="America/New_York"
            />
          </Stack>
          <Stack className="gap-1">
            <Label>Work days</Label>
            <Cluster className="gap-3">
              {WEEKDAYS.map((day) => (
                <Cluster key={day.value} className="items-center gap-1">
                  <Checkbox
                    id={`workDay-${day.value}`}
                    name="workDays"
                    value={day.value}
                    defaultChecked={day.value >= 1 && day.value <= 5}
                  />
                  <Label htmlFor={`workDay-${day.value}`}>{day.label}</Label>
                </Cluster>
              ))}
            </Cluster>
          </Stack>
          <Cluster className="gap-3">
            <Stack className="gap-1">
              <Label htmlFor="workStartMinutes">Work start (minutes after midnight)</Label>
              <Input
                id="workStartMinutes"
                name="workStartMinutes"
                type="number"
                defaultValue={540}
                required
              />
            </Stack>
            <Stack className="gap-1">
              <Label htmlFor="workEndMinutes">Work end (minutes after midnight)</Label>
              <Input
                id="workEndMinutes"
                name="workEndMinutes"
                type="number"
                defaultValue={1020}
                required
              />
            </Stack>
          </Cluster>
          <Cluster className="justify-end">
            <Button type="submit">Add calendar</Button>
          </Cluster>
        </form>
      </Stack>

      <Stack className="gap-4">
        <Heading as="h2">Calendars</Heading>
        {calendars.length === 0 ? (
          <Text className="text-muted">No business calendars yet.</Text>
        ) : (
          calendars.map((calendar) => (
            <Stack key={calendar.id} className="gap-3 rounded-md border border-border p-4">
              <Text className="font-medium">{calendar.name}</Text>
              <Text className="text-sm text-muted">
                {calendar.timezone} · work days {calendar.work_days.join(",")} ·{" "}
                {calendar.work_start_minutes}-{calendar.work_end_minutes} min
              </Text>
              <form
                action={addBusinessCalendarHolidayAction.bind(null, calendar.id)}
                className="flex flex-wrap items-end gap-2"
              >
                <Stack className="gap-1">
                  <Label htmlFor={`holiday-date-${calendar.id}`}>Holiday date</Label>
                  <Input id={`holiday-date-${calendar.id}`} name="date" type="date" required />
                </Stack>
                <Stack className="gap-1">
                  <Label htmlFor={`holiday-name-${calendar.id}`}>Name</Label>
                  <Input id={`holiday-name-${calendar.id}`} name="name" required />
                </Stack>
                <Button type="submit" variant="secondary">
                  Add holiday
                </Button>
              </form>
            </Stack>
          ))
        )}
      </Stack>
    </Stack>
  );
}
