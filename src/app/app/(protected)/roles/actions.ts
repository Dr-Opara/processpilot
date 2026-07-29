"use server";

import { revalidatePath } from "next/cache";
import {
  archiveCustomRole,
  createCustomRole,
  createCustomRoleFromTemplate,
  updateCustomRole,
} from "@/lib/services/custom-roles";
import { runFormAction } from "@/lib/form-actions";

function permissionKeysFrom(formData: FormData): string[] {
  return formData.getAll("permissionKeys").map(String);
}

export async function createCustomRoleAction(formData: FormData): Promise<void> {
  await runFormAction("/app/roles/new", async () => {
    const templateId = String(formData.get("templateId") ?? "");
    const name = String(formData.get("name") ?? "");
    if (templateId) {
      const role = await createCustomRoleFromTemplate(templateId, name);
      revalidatePath("/app/roles");
      return `/app/roles/${role.id}/edit`;
    }

    const role = await createCustomRole({
      name,
      description: String(formData.get("description") ?? "") || null,
      permissionKeys: permissionKeysFrom(formData),
    });
    revalidatePath("/app/roles");
    return `/app/roles/${role.id}/edit`;
  });
}

export async function updateCustomRoleAction(roleId: string, formData: FormData): Promise<void> {
  await runFormAction(`/app/roles/${roleId}/edit`, async () => {
    await updateCustomRole(roleId, {
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? "") || null,
      permissionKeys: permissionKeysFrom(formData),
    });
    revalidatePath("/app/roles");
    revalidatePath(`/app/roles/${roleId}/edit`);
    return `/app/roles/${roleId}/edit`;
  });
}

export async function archiveCustomRoleAction(roleId: string): Promise<void> {
  await archiveCustomRole(roleId);
  revalidatePath("/app/roles");
  revalidatePath(`/app/roles/${roleId}/edit`);
}
