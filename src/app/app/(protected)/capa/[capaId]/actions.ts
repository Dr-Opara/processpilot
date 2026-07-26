"use server";

import { revalidatePath } from "next/cache";
import { runFormAction } from "@/lib/form-actions";
import {
  addCapaAction,
  closeCapaPlan,
  completeCapaAction,
  decideCapaPlanApproval,
  recordCapaEffectivenessCheck,
  submitCapaPlanForApproval,
} from "@/lib/services/capa";

export async function addCapaActionAction(capaPlanId: string, formData: FormData): Promise<void> {
  await runFormAction(`/app/capa/${capaPlanId}`, async () => {
    await addCapaAction(capaPlanId, {
      actionType: String(formData.get("actionType") ?? "corrective") as "corrective" | "preventive",
      title: String(formData.get("title") ?? ""),
      ownerMemberId: String(formData.get("ownerMemberId") ?? ""),
      requiresEvidence: formData.get("requiresEvidence") === "on",
    });
    revalidatePath(`/app/capa/${capaPlanId}`);
    return `/app/capa/${capaPlanId}`;
  });
}

export async function completeCapaActionAction(
  capaPlanId: string,
  capaActionId: string,
): Promise<void> {
  await runFormAction(`/app/capa/${capaPlanId}`, async () => {
    await completeCapaAction(capaActionId);
    revalidatePath(`/app/capa/${capaPlanId}`);
    return `/app/capa/${capaPlanId}`;
  });
}

export async function submitCapaPlanForApprovalAction(capaPlanId: string): Promise<void> {
  await runFormAction(`/app/capa/${capaPlanId}`, async () => {
    await submitCapaPlanForApproval(capaPlanId);
    revalidatePath(`/app/capa/${capaPlanId}`);
    return `/app/capa/${capaPlanId}`;
  });
}

export async function decideCapaPlanApprovalAction(
  capaPlanId: string,
  decision: "approved" | "rejected",
  formData: FormData,
): Promise<void> {
  await runFormAction(`/app/capa/${capaPlanId}`, async () => {
    await decideCapaPlanApproval(capaPlanId, decision, String(formData.get("comment") ?? ""));
    revalidatePath(`/app/capa/${capaPlanId}`);
    return `/app/capa/${capaPlanId}`;
  });
}

export async function recordCapaEffectivenessCheckAction(
  capaPlanId: string,
  outcome: "effective" | "ineffective",
  formData: FormData,
): Promise<void> {
  await runFormAction(`/app/capa/${capaPlanId}`, async () => {
    await recordCapaEffectivenessCheck(capaPlanId, outcome, String(formData.get("notes") ?? ""));
    revalidatePath(`/app/capa/${capaPlanId}`);
    return `/app/capa/${capaPlanId}`;
  });
}

export async function closeCapaPlanAction(capaPlanId: string): Promise<void> {
  await runFormAction(`/app/capa/${capaPlanId}`, async () => {
    await closeCapaPlan(capaPlanId);
    revalidatePath("/app/capa");
    return `/app/capa/${capaPlanId}`;
  });
}
