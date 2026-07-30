"use server";

import { revalidatePath } from "next/cache";
import {
  addSupportNote,
  reactivateOrganization,
  suspendOrganization,
} from "@/lib/services/platform-admin";
import {
  markOrganizationAsDemo,
  resetDemoWorkspace,
  unmarkOrganizationAsDemo,
} from "@/lib/services/demo-workspace";
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

export async function markOrganizationAsDemoAction(organizationId: string): Promise<void> {
  await runFormAction(`/app/platform-admin/organizations/${organizationId}`, async () => {
    await markOrganizationAsDemo(organizationId);
    revalidatePath(`/app/platform-admin/organizations/${organizationId}`);
    return `/app/platform-admin/organizations/${organizationId}`;
  });
}

export async function unmarkOrganizationAsDemoAction(organizationId: string): Promise<void> {
  await runFormAction(`/app/platform-admin/organizations/${organizationId}`, async () => {
    await unmarkOrganizationAsDemo(organizationId);
    revalidatePath(`/app/platform-admin/organizations/${organizationId}`);
    return `/app/platform-admin/organizations/${organizationId}`;
  });
}

export async function resetDemoWorkspaceAction(organizationId: string): Promise<void> {
  await runFormAction(`/app/platform-admin/organizations/${organizationId}`, async () => {
    await resetDemoWorkspace();
    revalidatePath(`/app/platform-admin/organizations/${organizationId}`);
    return `/app/platform-admin/organizations/${organizationId}`;
  });
}
