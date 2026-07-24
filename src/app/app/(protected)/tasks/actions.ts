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
