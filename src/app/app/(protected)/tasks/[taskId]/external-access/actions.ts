"use server";

import { revalidatePath } from "next/cache";
import { runFormAction } from "@/lib/form-actions";
import { inviteExternalUser, revokeExternalAccessGrant } from "@/lib/services/external-access";

export async function inviteExternalUserAction(taskId: string, formData: FormData): Promise<void> {
  await runFormAction(`/app/tasks/${taskId}/external-access`, async () => {
    const expiresInDaysRaw = Number(formData.get("expiresInDays") ?? "");
    await inviteExternalUser({
      taskId,
      email: String(formData.get("email") ?? ""),
      expiresInDays:
        Number.isFinite(expiresInDaysRaw) && expiresInDaysRaw > 0 ? expiresInDaysRaw : 7,
    });
    revalidatePath(`/app/tasks/${taskId}/external-access`);
    return `/app/tasks/${taskId}/external-access`;
  });
}

export async function revokeExternalAccessGrantAction(
  taskId: string,
  grantId: string,
): Promise<void> {
  await runFormAction(`/app/tasks/${taskId}/external-access`, async () => {
    await revokeExternalAccessGrant(grantId);
    revalidatePath(`/app/tasks/${taskId}/external-access`);
    return `/app/tasks/${taskId}/external-access`;
  });
}
