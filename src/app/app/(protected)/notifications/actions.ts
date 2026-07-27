"use server";

import { revalidatePath } from "next/cache";
import { runFormAction } from "@/lib/form-actions";
import {
  markAllNotificationsRead,
  markNotificationRead,
  setMyNotificationPreference,
  setOrgDefaultNotificationPreference,
} from "@/lib/services/notifications";
import type { NotificationType } from "@/lib/db/database.types";

export async function markNotificationReadAction(notificationId: string): Promise<void> {
  await runFormAction("/app/notifications", async () => {
    await markNotificationRead(notificationId);
    revalidatePath("/app/notifications");
    return "/app/notifications";
  });
}

export async function markAllNotificationsReadAction(): Promise<void> {
  await runFormAction("/app/notifications", async () => {
    await markAllNotificationsRead();
    revalidatePath("/app/notifications");
    return "/app/notifications";
  });
}

export async function setMyNotificationPreferenceAction(formData: FormData): Promise<void> {
  await runFormAction("/app/notifications/preferences", async () => {
    const notificationType = String(formData.get("notificationType")) as NotificationType;
    const emailEnabled = formData.get("emailEnabled") === "on";
    await setMyNotificationPreference(notificationType, emailEnabled);
    revalidatePath("/app/notifications/preferences");
    return "/app/notifications/preferences";
  });
}

export async function setOrgDefaultNotificationPreferenceAction(formData: FormData): Promise<void> {
  await runFormAction("/app/notifications/preferences", async () => {
    const notificationType = String(formData.get("notificationType")) as NotificationType;
    const emailEnabled = formData.get("emailEnabled") === "on";
    await setOrgDefaultNotificationPreference(notificationType, emailEnabled);
    revalidatePath("/app/notifications/preferences");
    return "/app/notifications/preferences";
  });
}
