import { Heading, Text } from "@/components/ui/Typography";
import { Stack, Cluster } from "@/components/ui/Layout";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { getCurrentMembership } from "@/lib/authz";
import {
  getMyNotificationPreferences,
  getOrgDefaultNotificationPreferences,
} from "@/lib/services/notifications";
import { NOTIFICATION_TYPE_LABELS } from "@/lib/notifications/templates";
import { AppError } from "@/lib/errors";
import type { NotificationType } from "@/lib/db/database.types";
import {
  setMyNotificationPreferenceAction,
  setOrgDefaultNotificationPreferenceAction,
} from "../actions";

const NOTIFICATION_TYPES = Object.keys(NOTIFICATION_TYPE_LABELS) as NotificationType[];

export default async function NotificationPreferencesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  let loadError: string | null = null;
  let myPreferences: Awaited<ReturnType<typeof getMyNotificationPreferences>> = [];
  let orgDefaults: Awaited<ReturnType<typeof getOrgDefaultNotificationPreferences>> = [];
  let canEditOrgDefaults = false;

  try {
    const membership = await getCurrentMembership();
    canEditOrgDefaults =
      membership.permissions.includes("organization.settings") ||
      membership.scopedPermissions.includes("organization.settings");
    myPreferences = await getMyNotificationPreferences();
    if (canEditOrgDefaults) {
      orgDefaults = await getOrgDefaultNotificationPreferences().catch(() => []);
    }
  } catch (err) {
    loadError = err instanceof AppError ? err.message : "Could not load notification preferences.";
  }

  const myEmailEnabled = (type: NotificationType): boolean =>
    myPreferences.find((p) => p.member_id && p.notification_type === type)?.email_enabled ?? true;
  const orgDefaultEnabled = (type: NotificationType): boolean =>
    orgDefaults.find((p) => p.notification_type === type)?.email_enabled ?? true;

  return (
    <Stack className="mx-auto max-w-2xl gap-8">
      <Stack className="gap-1">
        <Heading as="h1">Notification preferences</Heading>
        <Text className="text-muted">
          In-app notifications always appear in your feed; these settings control email only.
        </Text>
      </Stack>

      {(error || loadError) && (
        <Alert title="Could not load preferences" description={error ?? loadError ?? ""} />
      )}

      {!loadError && (
        <Stack className="gap-3 rounded-md border border-border p-4">
          <Heading as="h2">Your email preferences</Heading>
          <Stack className="gap-3">
            {NOTIFICATION_TYPES.map((type) => (
              <form
                key={type}
                action={setMyNotificationPreferenceAction}
                className="flex items-center justify-between gap-3"
              >
                <input type="hidden" name="notificationType" value={type} />
                <Text className="text-sm">{NOTIFICATION_TYPE_LABELS[type]}</Text>
                <Cluster className="gap-2">
                  <label className="flex items-center gap-2 text-sm text-muted">
                    <input
                      type="checkbox"
                      name="emailEnabled"
                      defaultChecked={myEmailEnabled(type)}
                    />
                    Email
                  </label>
                  <Button type="submit" variant="quiet">
                    Save
                  </Button>
                </Cluster>
              </form>
            ))}
          </Stack>
        </Stack>
      )}

      {!loadError && canEditOrgDefaults && (
        <Stack className="gap-3 rounded-md border border-border p-4">
          <Heading as="h2">Organization defaults</Heading>
          <Text className="text-sm text-muted">
            Applies to any member who hasn&apos;t set their own preference for that type.
          </Text>
          <Stack className="gap-3">
            {NOTIFICATION_TYPES.map((type) => (
              <form
                key={type}
                action={setOrgDefaultNotificationPreferenceAction}
                className="flex items-center justify-between gap-3"
              >
                <input type="hidden" name="notificationType" value={type} />
                <Text className="text-sm">{NOTIFICATION_TYPE_LABELS[type]}</Text>
                <Cluster className="gap-2">
                  <label className="flex items-center gap-2 text-sm text-muted">
                    <input
                      type="checkbox"
                      name="emailEnabled"
                      defaultChecked={orgDefaultEnabled(type)}
                    />
                    Email
                  </label>
                  <Button type="submit" variant="quiet">
                    Save
                  </Button>
                </Cluster>
              </form>
            ))}
          </Stack>
        </Stack>
      )}
    </Stack>
  );
}
