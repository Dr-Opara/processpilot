"use server";

import { revalidatePath } from "next/cache";
import { runFormAction } from "@/lib/form-actions";
import { startWorkflow } from "@/lib/services/workflows";

export async function startWorkflowAction(processId: string): Promise<void> {
  await runFormAction(`/app/processes/${processId}`, async () => {
    const workflow = await startWorkflow(processId);
    revalidatePath("/app/workflows");
    return `/app/workflows/${workflow.id}`;
  });
}
