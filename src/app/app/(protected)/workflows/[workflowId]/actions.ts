"use server";

import { revalidatePath } from "next/cache";
import { runFormAction } from "@/lib/form-actions";
import {
  cancelWorkflow,
  restartWorkflow,
  resumeWorkflow,
  suspendWorkflow,
} from "@/lib/services/workflows";

export async function suspendWorkflowAction(workflowId: string): Promise<void> {
  await runFormAction(`/app/workflows/${workflowId}`, async () => {
    await suspendWorkflow(workflowId);
    revalidatePath(`/app/workflows/${workflowId}`);
    revalidatePath("/app/workflows");
    return `/app/workflows/${workflowId}`;
  });
}

export async function resumeWorkflowAction(workflowId: string): Promise<void> {
  await runFormAction(`/app/workflows/${workflowId}`, async () => {
    await resumeWorkflow(workflowId);
    revalidatePath(`/app/workflows/${workflowId}`);
    revalidatePath("/app/workflows");
    return `/app/workflows/${workflowId}`;
  });
}

export async function cancelWorkflowAction(workflowId: string, formData: FormData): Promise<void> {
  await runFormAction(`/app/workflows/${workflowId}`, async () => {
    await cancelWorkflow(workflowId, String(formData.get("reason") ?? ""));
    revalidatePath(`/app/workflows/${workflowId}`);
    revalidatePath("/app/workflows");
    return `/app/workflows/${workflowId}`;
  });
}

export async function restartWorkflowAction(workflowId: string): Promise<void> {
  await runFormAction(`/app/workflows/${workflowId}`, async () => {
    const restarted = await restartWorkflow(workflowId);
    revalidatePath(`/app/workflows/${workflowId}`);
    revalidatePath("/app/workflows");
    return `/app/workflows/${restarted.id}`;
  });
}
