"use server";

import { revalidatePath } from "next/cache";
import { runFormAction } from "@/lib/form-actions";
import {
  addExceptionComment,
  closeException,
  rejectException,
  reopenException,
  startInvestigation,
  triageException,
} from "@/lib/services/exceptions";
import { addRootCauseFactor, upsertRootCauseAnalysis } from "@/lib/services/exception-root-cause";
import {
  completeContainmentAction,
  createContainmentAction,
} from "@/lib/services/exception-containment";
import { createCapaPlan } from "@/lib/services/capa";
import { requestWaiver } from "@/lib/services/waivers";

export async function triageExceptionAction(
  exceptionId: string,
  formData: FormData,
): Promise<void> {
  await runFormAction(`/app/exceptions/${exceptionId}`, async () => {
    const ownerMemberId = String(formData.get("ownerMemberId") ?? "").trim();
    const investigatorMemberId = String(formData.get("investigatorMemberId") ?? "").trim();
    await triageException(exceptionId, {
      severity: (String(formData.get("severity") ?? "") || undefined) as never,
      ownerMemberId: ownerMemberId || undefined,
      investigatorMemberId: investigatorMemberId || undefined,
    });
    revalidatePath(`/app/exceptions/${exceptionId}`);
    return `/app/exceptions/${exceptionId}`;
  });
}

export async function startInvestigationAction(exceptionId: string): Promise<void> {
  await runFormAction(`/app/exceptions/${exceptionId}`, async () => {
    await startInvestigation(exceptionId);
    revalidatePath(`/app/exceptions/${exceptionId}`);
    return `/app/exceptions/${exceptionId}`;
  });
}

export async function saveRootCauseAction(exceptionId: string, formData: FormData): Promise<void> {
  await runFormAction(`/app/exceptions/${exceptionId}`, async () => {
    await upsertRootCauseAnalysis(exceptionId, {
      method: String(formData.get("method") ?? "five_whys") as never,
      primaryRootCause: String(formData.get("primaryRootCause") ?? "") || undefined,
      investigatorNotes: String(formData.get("investigatorNotes") ?? "") || undefined,
    });
    revalidatePath(`/app/exceptions/${exceptionId}`);
    return `/app/exceptions/${exceptionId}`;
  });
}

export async function addRootCauseFactorAction(
  exceptionId: string,
  rootCauseAnalysisId: string,
  formData: FormData,
): Promise<void> {
  await runFormAction(`/app/exceptions/${exceptionId}`, async () => {
    await addRootCauseFactor(rootCauseAnalysisId, {
      factorType: String(formData.get("factorType") ?? "five_why_step") as never,
      sequenceOrder: 0,
      description: String(formData.get("description") ?? ""),
    });
    revalidatePath(`/app/exceptions/${exceptionId}`);
    return `/app/exceptions/${exceptionId}`;
  });
}

export async function createContainmentActionAction(
  exceptionId: string,
  formData: FormData,
): Promise<void> {
  await runFormAction(`/app/exceptions/${exceptionId}`, async () => {
    await createContainmentAction(exceptionId, {
      action: String(formData.get("action") ?? ""),
      ownerMemberId: String(formData.get("ownerMemberId") ?? ""),
    });
    revalidatePath(`/app/exceptions/${exceptionId}`);
    return `/app/exceptions/${exceptionId}`;
  });
}

export async function completeContainmentActionAction(
  exceptionId: string,
  containmentActionId: string,
): Promise<void> {
  await runFormAction(`/app/exceptions/${exceptionId}`, async () => {
    await completeContainmentAction(containmentActionId);
    revalidatePath(`/app/exceptions/${exceptionId}`);
    return `/app/exceptions/${exceptionId}`;
  });
}

export async function addExceptionCommentAction(
  exceptionId: string,
  formData: FormData,
): Promise<void> {
  await runFormAction(`/app/exceptions/${exceptionId}`, async () => {
    await addExceptionComment(exceptionId, String(formData.get("body") ?? ""));
    revalidatePath(`/app/exceptions/${exceptionId}`);
    return `/app/exceptions/${exceptionId}`;
  });
}

export async function createCapaPlanAction(exceptionId: string, formData: FormData): Promise<void> {
  await runFormAction(`/app/exceptions/${exceptionId}`, async () => {
    const plan = await createCapaPlan(exceptionId, {
      title: String(formData.get("title") ?? ""),
      ownerMemberId: String(formData.get("ownerMemberId") ?? ""),
    });
    revalidatePath(`/app/exceptions/${exceptionId}`);
    return `/app/capa/${plan.id}`;
  });
}

export async function requestWaiverAction(exceptionId: string, formData: FormData): Promise<void> {
  await runFormAction(`/app/exceptions/${exceptionId}`, async () => {
    const waiver = await requestWaiver(exceptionId, {
      businessJustification: String(formData.get("businessJustification") ?? ""),
      expiresAt: new Date(String(formData.get("expiresAt") ?? "")).toISOString(),
    });
    revalidatePath(`/app/exceptions/${exceptionId}`);
    return `/app/waivers/${waiver.id}`;
  });
}

export async function closeExceptionAction(exceptionId: string, formData: FormData): Promise<void> {
  await runFormAction(`/app/exceptions/${exceptionId}`, async () => {
    await closeException(exceptionId, {
      closureReason: String(formData.get("closureReason") ?? ""),
    });
    revalidatePath("/app/exceptions");
    return `/app/exceptions/${exceptionId}`;
  });
}

export async function rejectExceptionAction(
  exceptionId: string,
  formData: FormData,
): Promise<void> {
  await runFormAction(`/app/exceptions/${exceptionId}`, async () => {
    await rejectException(exceptionId, String(formData.get("reason") ?? ""));
    revalidatePath("/app/exceptions");
    return `/app/exceptions/${exceptionId}`;
  });
}

export async function reopenExceptionAction(
  exceptionId: string,
  formData: FormData,
): Promise<void> {
  await runFormAction(`/app/exceptions/${exceptionId}`, async () => {
    await reopenException(exceptionId, String(formData.get("reason") ?? ""));
    revalidatePath("/app/exceptions");
    return `/app/exceptions/${exceptionId}`;
  });
}
