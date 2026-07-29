"use server";

import { revalidatePath } from "next/cache";
import { delegateAdministrator } from "@/lib/services/delegated-admins";
import { runFormAction } from "@/lib/form-actions";

export async function delegateAdministratorAction(
  memberId: string,
  formData: FormData,
): Promise<void> {
  await runFormAction(`/app/members/${memberId}`, async () => {
    await delegateAdministrator({
      memberId,
      roleId: String(formData.get("roleId") ?? ""),
      departmentId: String(formData.get("departmentId") ?? "") || null,
      locationId: String(formData.get("locationId") ?? "") || null,
      teamId: String(formData.get("teamId") ?? "") || null,
    });
    revalidatePath(`/app/members/${memberId}`);
    return `/app/members/${memberId}`;
  });
}
