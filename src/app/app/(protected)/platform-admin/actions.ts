"use server";

import { revalidatePath } from "next/cache";
import {
  addSupportNote,
  reactivateOrganization,
  suspendOrganization,
} from "@/lib/services/platform-admin";
import { runFormAction } from "@/lib/form-actions";

export async function suspendOrganizationAction(
  organizationId: string,
  formData: FormData,
): Promise<void> {
  await runFormAction(`/app/platform-admin/organizations/${organizationId}`, async () => {
    await suspendOrganization({
      organizationId,
      reason: String(formData.get("reason") ?? ""),
    });
    revalidatePath(`/app/platform-admin/organizations/${organizationId}`);
    revalidatePath("/app/platform-admin/organizations");
    return `/app/platform-admin/organizations/${organizationId}`;
  });
}

export async function reactivateOrganizationAction(organizationId: string): Promise<void> {
  await reactivateOrganization(organizationId);
  revalidatePath(`/app/platform-admin/organizations/${organizationId}`);
  revalidatePath("/app/platform-admin/organizations");
}

export async function addSupportNoteAction(
  organizationId: string,
  formData: FormData,
): Promise<void> {
  await runFormAction(`/app/platform-admin/organizations/${organizationId}`, async () => {
    await addSupportNote({
      organizationId,
      note: String(formData.get("note") ?? ""),
    });
    revalidatePath(`/app/platform-admin/organizations/${organizationId}`);
    return `/app/platform-admin/organizations/${organizationId}`;
  });
}
