"use server";

import { revalidatePath } from "next/cache";
import { runFormAction } from "@/lib/form-actions";
import {
  approvalPolicyInputSchema,
  archiveApprovalPolicy,
  createApprovalPolicy,
  restoreApprovalPolicy,
} from "@/lib/services/approval-policies";

function parseApproverRules(formData: FormData) {
  const raw = String(formData.get("approverRules") ?? "[]");
  return JSON.parse(raw) as unknown;
}

export async function createApprovalPolicyAction(formData: FormData): Promise<void> {
  await runFormAction("/app/approval-policies/new", async () => {
    const input = approvalPolicyInputSchema.parse({
      name: String(formData.get("name") ?? ""),
      strategy: String(formData.get("strategy") ?? "unanimous"),
      approverRules: parseApproverRules(formData),
      allowDelegation: formData.get("allowDelegation") === "on",
      allowAbstain: formData.get("allowAbstain") === "on",
      preventSelfApproval: formData.get("preventSelfApproval") === "on",
    });
    await createApprovalPolicy(input);
    revalidatePath("/app/approval-policies");
    return "/app/approval-policies";
  });
}

export async function archiveApprovalPolicyAction(policyId: string): Promise<void> {
  await archiveApprovalPolicy(policyId);
  revalidatePath("/app/approval-policies");
}

export async function restoreApprovalPolicyAction(policyId: string): Promise<void> {
  await restoreApprovalPolicy(policyId);
  revalidatePath("/app/approval-policies");
}
