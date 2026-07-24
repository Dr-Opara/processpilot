"use server";

import { revalidatePath } from "next/cache";
import { runFormAction } from "@/lib/form-actions";
import {
  claimTask,
  completeTask,
  decideApproval,
  reassignTask,
  skipTask,
} from "@/lib/services/workflows";
import { amendForm, saveFormDraft, submitForm } from "@/lib/services/form-submissions";
import { reviewEvidence } from "@/lib/services/evidence";

function parseOutput(formData: FormData): Record<string, unknown> | undefined {
  const raw = String(formData.get("output") ?? "").trim();
  if (!raw) return undefined;
  return JSON.parse(raw) as Record<string, unknown>;
}

export async function claimTaskAction(taskId: string): Promise<void> {
  await runFormAction(`/app/tasks/${taskId}`, async () => {
    await claimTask(taskId);
    revalidatePath(`/app/tasks/${taskId}`);
    revalidatePath("/app/tasks");
    return `/app/tasks/${taskId}`;
  });
}

export async function completeTaskAction(taskId: string, formData: FormData): Promise<void> {
  await runFormAction(`/app/tasks/${taskId}`, async () => {
    await completeTask(taskId, parseOutput(formData));
    revalidatePath(`/app/tasks/${taskId}`);
    revalidatePath("/app/tasks");
    return `/app/tasks/${taskId}`;
  });
}

export async function decideApprovalAction(
  taskId: string,
  decision: "approved" | "rejected",
  formData: FormData,
): Promise<void> {
  await runFormAction(`/app/tasks/${taskId}`, async () => {
    await decideApproval(taskId, decision, String(formData.get("comment") ?? ""));
    revalidatePath(`/app/tasks/${taskId}`);
    revalidatePath("/app/tasks");
    return `/app/tasks/${taskId}`;
  });
}

export async function reassignTaskAction(taskId: string, formData: FormData): Promise<void> {
  await runFormAction(`/app/tasks/${taskId}`, async () => {
    await reassignTask(taskId, String(formData.get("newAssigneeMemberId") ?? ""));
    revalidatePath(`/app/tasks/${taskId}`);
    revalidatePath("/app/tasks");
    return `/app/tasks/${taskId}`;
  });
}

export async function skipTaskAction(taskId: string): Promise<void> {
  await runFormAction(`/app/tasks/${taskId}`, async () => {
    await skipTask(taskId);
    revalidatePath(`/app/tasks/${taskId}`);
    revalidatePath("/app/tasks");
    return `/app/tasks/${taskId}`;
  });
}

function parseAnswers(formData: FormData): Record<string, unknown> {
  return JSON.parse(String(formData.get("answers") ?? "{}")) as Record<string, unknown>;
}

export async function saveFormDraftAction(taskId: string, formData: FormData): Promise<void> {
  await runFormAction(`/app/tasks/${taskId}`, async () => {
    await saveFormDraft(taskId, parseAnswers(formData));
    revalidatePath(`/app/tasks/${taskId}`);
    return `/app/tasks/${taskId}`;
  });
}

export async function submitFormAction(taskId: string, formData: FormData): Promise<void> {
  await runFormAction(`/app/tasks/${taskId}`, async () => {
    await submitForm(taskId, parseAnswers(formData));
    revalidatePath(`/app/tasks/${taskId}`);
    revalidatePath("/app/tasks");
    return `/app/tasks/${taskId}`;
  });
}

export async function amendFormAction(
  taskId: string,
  submissionId: string,
  formData: FormData,
): Promise<void> {
  await runFormAction(`/app/tasks/${taskId}`, async () => {
    await amendForm(submissionId, {
      answers: parseAnswers(formData),
      reason: String(formData.get("reason") ?? ""),
    });
    revalidatePath(`/app/tasks/${taskId}`);
    return `/app/tasks/${taskId}`;
  });
}

export async function reviewEvidenceAction(
  taskId: string,
  evidenceId: string,
  decision: "accepted" | "rejected",
  formData: FormData,
): Promise<void> {
  await runFormAction(`/app/tasks/${taskId}`, async () => {
    await reviewEvidence(evidenceId, { decision, notes: String(formData.get("notes") ?? "") });
    revalidatePath(`/app/tasks/${taskId}`);
    return `/app/tasks/${taskId}`;
  });
}
