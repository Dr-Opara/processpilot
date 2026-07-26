"use server";

import { revalidatePath } from "next/cache";
import { runFormAction } from "@/lib/form-actions";
import { decideWaiver, renewWaiver, revokeWaiver } from "@/lib/services/waivers";

export async function decideWaiverAction(
  waiverId: string,
  decision: "approved" | "rejected",
  formData: FormData,
): Promise<void> {
  await runFormAction(`/app/waivers/${waiverId}`, async () => {
    await decideWaiver(waiverId, decision, String(formData.get("comment") ?? ""));
    revalidatePath(`/app/waivers/${waiverId}`);
    return `/app/waivers/${waiverId}`;
  });
}

export async function renewWaiverAction(waiverId: string, formData: FormData): Promise<void> {
  await runFormAction(`/app/waivers/${waiverId}`, async () => {
    await renewWaiver(waiverId, new Date(String(formData.get("newExpiresAt") ?? "")).toISOString());
    revalidatePath(`/app/waivers/${waiverId}`);
    return `/app/waivers/${waiverId}`;
  });
}

export async function revokeWaiverAction(waiverId: string): Promise<void> {
  await runFormAction(`/app/waivers/${waiverId}`, async () => {
    await revokeWaiver(waiverId);
    revalidatePath("/app/waivers");
    return `/app/waivers/${waiverId}`;
  });
}
