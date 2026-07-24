"use server";

import { revalidatePath } from "next/cache";
import {
  archiveForm,
  createForm,
  createDraftVersion,
  publishFormVersion,
  restoreForm,
  updateDraftVersion,
} from "@/lib/services/forms";
import { formDefinitionSchema } from "@/lib/services/form-schema";
import { runFormAction } from "@/lib/form-actions";

function parseDefinition(formData: FormData) {
  const raw = String(formData.get("definition") ?? "{}");
  return formDefinitionSchema.parse(JSON.parse(raw));
}

export async function createFormAction(formData: FormData): Promise<void> {
  await runFormAction("/app/forms/new", async () => {
    const title = String(formData.get("title") ?? "");
    const definition = parseDefinition(formData);

    const form = await createForm({ title });
    await createDraftVersion(form.id, { title, definition });

    revalidatePath("/app/forms");
    return `/app/forms/${form.id}`;
  });
}

export async function archiveFormAction(formId: string): Promise<void> {
  await archiveForm(formId);
  revalidatePath("/app/forms");
  revalidatePath(`/app/forms/${formId}`);
}

export async function restoreFormAction(formId: string): Promise<void> {
  await restoreForm(formId);
  revalidatePath("/app/forms");
  revalidatePath(`/app/forms/${formId}`);
}

export async function updateDraftVersionAction(
  formId: string,
  versionId: string,
  formData: FormData,
): Promise<void> {
  await runFormAction(`/app/forms/${formId}/edit`, async () => {
    await updateDraftVersion(versionId, {
      title: String(formData.get("title") ?? ""),
      definition: parseDefinition(formData),
    });
    revalidatePath(`/app/forms/${formId}`);
    return `/app/forms/${formId}`;
  });
}

export async function createNewVersionAction(formId: string, formData: FormData): Promise<void> {
  await runFormAction(`/app/forms/${formId}/edit`, async () => {
    await createDraftVersion(formId, {
      title: String(formData.get("title") ?? ""),
      definition: parseDefinition(formData),
    });
    revalidatePath(`/app/forms/${formId}`);
    return `/app/forms/${formId}`;
  });
}

export async function publishFormVersionAction(formId: string, versionId: string): Promise<void> {
  await runFormAction(`/app/forms/${formId}`, async () => {
    await publishFormVersion(versionId);
    revalidatePath("/app/forms");
    revalidatePath(`/app/forms/${formId}`);
    return `/app/forms/${formId}`;
  });
}
