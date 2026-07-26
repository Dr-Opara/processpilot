"use server";

import { revalidatePath } from "next/cache";
import { runFormAction } from "@/lib/form-actions";
import { createExceptionInputSchema, createException } from "@/lib/services/exceptions";

function parseTags(formData: FormData): string[] {
  const raw = String(formData.get("tags") ?? "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export async function createExceptionAction(formData: FormData): Promise<void> {
  await runFormAction("/app/exceptions/new", async () => {
    const input = createExceptionInputSchema.parse({
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? "") || undefined,
      exceptionType: String(formData.get("exceptionType") ?? "other"),
      source: String(formData.get("source") ?? "employee_submission"),
      severity: String(formData.get("severity") ?? "moderate"),
      tags: parseTags(formData),
    });
    const created = await createException(input);
    revalidatePath("/app/exceptions");
    return `/app/exceptions/${created.id}`;
  });
}
