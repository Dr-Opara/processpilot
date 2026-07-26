"use server";

import { revalidatePath } from "next/cache";
import { runFormAction } from "@/lib/form-actions";
import { askQuestion } from "@/lib/services/ai-qa";
import { extractProcessSteps } from "@/lib/services/ai-process-extraction";
import { draftTrainingContent } from "@/lib/services/ai-training-draft";
import { compareDocumentVersions } from "@/lib/services/ai-document-comparison";
import { summarizeException } from "@/lib/services/ai-exception-summary";
import { suggestProcessImprovements } from "@/lib/services/ai-process-improvement";
import { acceptAiDraft, dismissAiDraft } from "@/lib/services/ai-drafts";
import { getDocument } from "@/lib/services/knowledge-documents";
import { AppError } from "@/lib/errors";

export async function askQuestionAction(formData: FormData): Promise<void> {
  await runFormAction("/app/ai", async () => {
    await askQuestion({ question: String(formData.get("question") ?? "") });
    revalidatePath("/app/ai");
    return "/app/ai";
  });
}

export async function extractProcessStepsAction(formData: FormData): Promise<void> {
  await runFormAction("/app/ai", async () => {
    await extractProcessSteps(String(formData.get("knowledgeDocumentId") ?? ""));
    revalidatePath("/app/ai");
    return "/app/ai";
  });
}

export async function draftTrainingContentAction(formData: FormData): Promise<void> {
  await runFormAction("/app/ai", async () => {
    const sourceDocumentId = String(formData.get("sourceDocumentId") ?? "");
    await draftTrainingContent({
      courseId: String(formData.get("courseId") ?? ""),
      topic: String(formData.get("topic") ?? ""),
      sourceDocumentIds: sourceDocumentId ? [sourceDocumentId] : [],
    });
    revalidatePath("/app/ai");
    return "/app/ai";
  });
}

export async function compareDocumentVersionsAction(formData: FormData): Promise<void> {
  await runFormAction("/app/ai", async () => {
    const documentId = String(formData.get("documentId") ?? "");
    const { versions } = await getDocument(documentId);
    const sorted = [...versions].sort((a, b) => b.version_number - a.version_number);
    if (sorted.length < 2)
      throw new AppError("conflict", "This document needs at least two versions to compare.");
    await compareDocumentVersions(documentId, sorted[1].id, sorted[0].id);
    revalidatePath("/app/ai");
    return "/app/ai";
  });
}

export async function summarizeExceptionAction(formData: FormData): Promise<void> {
  await runFormAction("/app/ai", async () => {
    await summarizeException(String(formData.get("exceptionId") ?? ""));
    revalidatePath("/app/ai");
    return "/app/ai";
  });
}

export async function suggestProcessImprovementsAction(formData: FormData): Promise<void> {
  await runFormAction("/app/ai", async () => {
    await suggestProcessImprovements(String(formData.get("processId") ?? ""));
    revalidatePath("/app/ai");
    return "/app/ai";
  });
}

export async function acceptAiDraftAction(draftId: string): Promise<void> {
  await runFormAction("/app/ai", async () => {
    await acceptAiDraft(draftId);
    revalidatePath("/app/ai");
    return "/app/ai";
  });
}

export async function dismissAiDraftAction(draftId: string): Promise<void> {
  await runFormAction("/app/ai", async () => {
    await dismissAiDraft(draftId);
    revalidatePath("/app/ai");
    return "/app/ai";
  });
}
