"use server";

import { revalidatePath } from "next/cache";
import {
  archiveLocation,
  createLocation,
  restoreLocation,
  updateLocation,
} from "@/lib/services/locations";
import { runFormAction } from "@/lib/form-actions";

function formToInput(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    addressLine1: String(formData.get("addressLine1") ?? "") || undefined,
    addressLine2: String(formData.get("addressLine2") ?? "") || undefined,
    city: String(formData.get("city") ?? "") || undefined,
    region: String(formData.get("region") ?? "") || undefined,
    postalCode: String(formData.get("postalCode") ?? "") || undefined,
    country: String(formData.get("country") ?? "") || undefined,
    timezone: String(formData.get("timezone") ?? "") || undefined,
    managerMemberId: String(formData.get("managerMemberId") ?? "") || null,
  };
}

export async function createLocationAction(formData: FormData): Promise<void> {
  await runFormAction("/app/locations/new", async () => {
    const location = await createLocation(formToInput(formData));
    revalidatePath("/app/locations");
    return `/app/locations/${location.id}`;
  });
}

export async function updateLocationAction(locationId: string, formData: FormData): Promise<void> {
  await runFormAction(`/app/locations/${locationId}/edit`, async () => {
    await updateLocation(locationId, formToInput(formData));
    revalidatePath("/app/locations");
    revalidatePath(`/app/locations/${locationId}`);
    return `/app/locations/${locationId}`;
  });
}

export async function archiveLocationAction(locationId: string): Promise<void> {
  await archiveLocation(locationId);
  revalidatePath("/app/locations");
  revalidatePath(`/app/locations/${locationId}`);
}

export async function restoreLocationAction(locationId: string): Promise<void> {
  await restoreLocation(locationId);
  revalidatePath("/app/locations");
  revalidatePath(`/app/locations/${locationId}`);
}
