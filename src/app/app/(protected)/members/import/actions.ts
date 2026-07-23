"use server";

import { revalidatePath } from "next/cache";
import { confirmImport, previewImport } from "@/lib/services/member-import";
import type { ImportOutcome, ImportPreview } from "@/lib/services/member-import";
import { formErrorMessage } from "@/lib/form-actions";

export type PreviewImportResult =
  { ok: true; preview: ImportPreview } | { ok: false; error: string };
export type ConfirmImportResult =
  { ok: true; outcome: ImportOutcome } | { ok: false; error: string };

export async function previewImportAction(csvText: string): Promise<PreviewImportResult> {
  try {
    const preview = await previewImport(csvText, new TextEncoder().encode(csvText).length);
    return { ok: true, preview };
  } catch (error) {
    return { ok: false, error: formErrorMessage(error) };
  }
}

export async function confirmImportAction(
  csvText: string,
  originalFilename: string,
): Promise<ConfirmImportResult> {
  try {
    const outcome = await confirmImport(
      csvText,
      new TextEncoder().encode(csvText).length,
      originalFilename,
    );
    revalidatePath("/app/members");
    revalidatePath("/app/members/import/history");
    return { ok: true, outcome };
  } catch (error) {
    return { ok: false, error: formErrorMessage(error) };
  }
}
