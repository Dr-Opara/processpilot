import Link from "next/link";
import { Heading, Text } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { listMyNotifications } from "@/lib/services/notifications";
import { AppError } from "@/lib/errors";
import { markAllNotificationsReadAction, markNotificationReadAction } from "./actions";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ unread?: string; error?: string }>;
}) {
  const { unread, error } = await searchParams;

  let notifications: Awaited<ReturnType<typeof listMyNotifications>> = [];
  let loadError: string | null = null;
  try {
    notifications = await listMyNotifications({ unreadOnly: unread === "true" });
  } catch (err) {
    loadError = err instanceof AppError ? err.message : "Could not load notifications.";
  }

  return (
    <Stack className="mx-auto max-w-2xl gap-6">
      <Cluster className="justify-between">
        <Stack className="gap-1">
          <Heading as="h1">Notifications</Heading>
          <Text className="text-muted">
            Task assignments, approvals, deadlines, and exceptions.
          </Text>
        </Stack>
        <Link href={{ pathname: "/app/notifications/preferences" }} className="text-sm text-cobalt">
          Preferences
        </Link>
      </Cluster>

      {(error || loadError) && (
        <Alert title="Could not load notifications" description={error ?? loadError ?? ""} />
      )}

      <Cluster className="justify-between gap-2 text-sm">
        <Cluster className="gap-2">
          <Link href={{ pathname: "/app/notifications" }} className="text-cobalt">
            All
          </Link>
          <Link
            href={{ pathname: "/app/notifications", query: { unread: "true" } }}
            className="text-cobalt"
          >
            Unread
          </Link>
        </Cluster>
        <form action={markAllNotificationsReadAction}>
          <Button type="submit" variant="quiet">
            Mark all read
          </Button>
        </form>
      </Cluster>

      {!loadError && notifications.length === 0 && (
        <Alert title="Nothing here yet" description="You'll see notifications as things happen." />
      )}

      {!loadError && notifications.length > 0 && (
        <Stack className="gap-2">
          {notifications.map((notification) => (
            <Stack
              key={notification.id}
              className={`gap-1 rounded-md border p-4 ${notification.read_at ? "border-border" : "border-cobalt bg-cobalt/5"}`}
            >
              <Cluster className="justify-between">
                <Text className="font-semibold">{notification.title}</Text>
                <Text className="text-xs text-muted">
                  {new Date(notification.created_at).toLocaleString()}
                </Text>
              </Cluster>
              <Text className="text-sm text-muted">{notification.body}</Text>
              {!notification.read_at && (
                <form action={markNotificationReadAction.bind(null, notification.id)}>
                  <Button type="submit" variant="quiet" className="self-start px-0 text-xs">
                    Mark read
                  </Button>
                </form>
              )}
            </Stack>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
