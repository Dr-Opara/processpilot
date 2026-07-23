"use server";

import { revalidatePath } from "next/cache";
import {
  archiveDepartment,
  createDepartment,
  restoreDepartment,
  updateDepartment,
} from "@/lib/services/departments";
import { runFormAction } from "@/lib/form-actions";

function formToInput(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    locationId: String(formData.get("locationId") ?? "") || null,
    parentDepartmentId: String(formData.get("parentDepartmentId") ?? "") || null,
    ownerMemberId: String(formData.get("ownerMemberId") ?? "") || null,
  };
}

export async function createDepartmentAction(formData: FormData): Promise<void> {
  await runFormAction("/app/departments/new", async () => {
    const department = await createDepartment(formToInput(formData));
    revalidatePath("/app/departments");
    return `/app/departments/${department.id}`;
  });
}

export async function updateDepartmentAction(
  departmentId: string,
  formData: FormData,
): Promise<void> {
  await runFormAction(`/app/departments/${departmentId}/edit`, async () => {
    await updateDepartment(departmentId, formToInput(formData));
    revalidatePath("/app/departments");
    revalidatePath(`/app/departments/${departmentId}`);
    return `/app/departments/${departmentId}`;
  });
}

export async function archiveDepartmentAction(departmentId: string): Promise<void> {
  await archiveDepartment(departmentId);
  revalidatePath("/app/departments");
  revalidatePath(`/app/departments/${departmentId}`);
}

export async function restoreDepartmentAction(departmentId: string): Promise<void> {
  await restoreDepartment(departmentId);
  revalidatePath("/app/departments");
  revalidatePath(`/app/departments/${departmentId}`);
}
