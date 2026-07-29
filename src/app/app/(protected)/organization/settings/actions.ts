"use server";

import { revalidatePath } from "next/cache";
import {
  updateBranding,
  updateSecuritySettings,
  updateDataRetentionSettings,
} from "@/lib/services/organization-settings-extended";
import {
  addApprovedDomain,
  removeApprovedDomain,
  verifyApprovedDomain,
} from "@/lib/services/approved-domains";
import {
  requestOrganizationDeletion,
  cancelOrganizationDeletion,
} from "@/lib/services/organization-deletion";
import { transferOwnership } from "@/lib/services/members";
import { runFormAction } from "@/lib/form-actions";

const SETTINGS_PATH = "/app/organization/settings";

export async function updateBrandingAction(formData: FormData): Promise<void> {
  await runFormAction(SETTINGS_PATH, async () => {
    await updateBranding({
      logoUrl: String(formData.get("logoUrl") ?? "") || null,
      brandColor: String(formData.get("brandColor") ?? "") || null,
      locale: String(formData.get("locale") ?? "en-US"),
    });
    revalidatePath(SETTINGS_PATH);
    return SETTINGS_PATH;
  });
}

export async function updateSecuritySettingsAction(formData: FormData): Promise<void> {
  await runFormAction(SETTINGS_PATH, async () => {
    const timeout = String(formData.get("sessionIdleTimeoutMinutes") ?? "");
    await updateSecuritySettings({
      sessionIdleTimeoutMinutes: timeout ? Number(timeout) : null,
      requireVerifiedDomainSignup: formData.get("requireVerifiedDomainSignup") === "on",
    });
    revalidatePath(SETTINGS_PATH);
    return SETTINGS_PATH;
  });
}

export async function updateDataRetentionSettingsAction(formData: FormData): Promise<void> {
  await runFormAction(SETTINGS_PATH, async () => {
    const parse = (key: string) => {
      const value = String(formData.get(key) ?? "");
      return value ? Number(value) : null;
    };
    await updateDataRetentionSettings({
      auditRetentionDays: parse("auditRetentionDays"),
      evidenceRetentionDays: parse("evidenceRetentionDays"),
      exceptionRetentionDays: parse("exceptionRetentionDays"),
    });
    revalidatePath(SETTINGS_PATH);
    return SETTINGS_PATH;
  });
}

export async function addApprovedDomainAction(formData: FormData): Promise<void> {
  await runFormAction(SETTINGS_PATH, async () => {
    await addApprovedDomain({ domain: String(formData.get("domain") ?? "") });
    revalidatePath(SETTINGS_PATH);
    return SETTINGS_PATH;
  });
}

export async function verifyApprovedDomainAction(domainId: string): Promise<void> {
  await verifyApprovedDomain(domainId);
  revalidatePath(SETTINGS_PATH);
}

export async function removeApprovedDomainAction(domainId: string): Promise<void> {
  await removeApprovedDomain(domainId);
  revalidatePath(SETTINGS_PATH);
}

export async function requestOrganizationDeletionAction(formData: FormData): Promise<void> {
  await runFormAction(SETTINGS_PATH, async () => {
    await requestOrganizationDeletion({
      confirmationOrgName: String(formData.get("confirmationOrgName") ?? ""),
      reason: String(formData.get("reason") ?? "") || null,
    });
    revalidatePath(SETTINGS_PATH);
    return SETTINGS_PATH;
  });
}

export async function cancelOrganizationDeletionAction(requestId: string): Promise<void> {
  await cancelOrganizationDeletion(requestId);
  revalidatePath(SETTINGS_PATH);
}

export async function transferOwnershipAction(formData: FormData): Promise<void> {
  await runFormAction(SETTINGS_PATH, async () => {
    await transferOwnership(String(formData.get("newOwnerMemberId") ?? ""));
    revalidatePath(SETTINGS_PATH);
    return SETTINGS_PATH;
  });
}
