"use server";

import { revalidatePath } from "next/cache";
import { runFormAction } from "@/lib/form-actions";
import {
  completeTrainingAssignment,
  retakeTrainingAssignment,
  startTrainingAssignment,
} from "@/lib/services/training-assignments";

export async function startTrainingAssignmentAction(assignmentId: string): Promise<void> {
  await runFormAction(`/app/training/assignments/${assignmentId}`, async () => {
    await startTrainingAssignment(assignmentId);
    revalidatePath(`/app/training/assignments/${assignmentId}`);
    return `/app/training/assignments/${assignmentId}`;
  });
}

export async function completeTrainingAssignmentAction(
  assignmentId: string,
  formData: FormData,
): Promise<void> {
  await runFormAction(`/app/training/assignments/${assignmentId}`, async () => {
    const answers: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("answer_")) answers[key.replace("answer_", "")] = String(value);
    }
    await completeTrainingAssignment(assignmentId, { answers });
    revalidatePath(`/app/training/assignments/${assignmentId}`);
    revalidatePath("/app/training/my");
    return `/app/training/assignments/${assignmentId}`;
  });
}

export async function retakeTrainingAssignmentAction(assignmentId: string): Promise<void> {
  await runFormAction(`/app/training/assignments/${assignmentId}`, async () => {
    await retakeTrainingAssignment(assignmentId);
    revalidatePath(`/app/training/assignments/${assignmentId}`);
    return `/app/training/assignments/${assignmentId}`;
  });
}
