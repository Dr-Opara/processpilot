"use server";

import { revalidatePath } from "next/cache";
import { archiveProcess, createProcess, restoreProcess } from "@/lib/services/processes";
import {
  approveVersion,
  createVersion,
  processGraphSchema,
  publishVersion,
  rejectReview,
  submitForReview,
  updateDraftVersion,
} from "@/lib/services/process-versions";
import { runFormAction } from "@/lib/form-actions";

function parseGraph(formData: FormData) {
  const raw = String(formData.get("definition") ?? "{}");
  return processGraphSchema.parse(JSON.parse(raw));
}

export async function createProcessAction(formData: FormData): Promise<void> {
  await runFormAction("/app/processes/new", async () => {
    const title = String(formData.get("title") ?? "");
    const graph = parseGraph(formData);

    const process = await createProcess({
      title,
      ownerMemberId: String(formData.get("ownerMemberId") ?? "") || null,
      departmentId: String(formData.get("departmentId") ?? "") || null,
    });
    await createVersion(process.id, title, graph);

    revalidatePath("/app/processes");
    return `/app/processes/${process.id}`;
  });
}

export async function archiveProcessAction(processId: string): Promise<void> {
  await archiveProcess(processId);
  revalidatePath("/app/processes");
  revalidatePath(`/app/processes/${processId}`);
}

export async function restoreProcessAction(processId: string): Promise<void> {
  await restoreProcess(processId);
  revalidatePath("/app/processes");
  revalidatePath(`/app/processes/${processId}`);
}

export async function updateDraftVersionAction(
  processId: string,
  versionId: string,
  formData: FormData,
): Promise<void> {
  await runFormAction(`/app/processes/${processId}/edit`, async () => {
    await updateDraftVersion(versionId, {
      title: String(formData.get("title") ?? ""),
      graph: parseGraph(formData),
    });
    revalidatePath(`/app/processes/${processId}`);
    return `/app/processes/${processId}`;
  });
}

export async function createNewVersionAction(processId: string, formData: FormData): Promise<void> {
  await runFormAction(`/app/processes/${processId}/new-version`, async () => {
    const title = String(formData.get("title") ?? "");
    const graph = parseGraph(formData);
    await createVersion(processId, title, graph);
    revalidatePath(`/app/processes/${processId}`);
    return `/app/processes/${processId}`;
  });
}

export async function submitForReviewAction(processId: string, versionId: string): Promise<void> {
  await runFormAction(`/app/processes/${processId}`, async () => {
    await submitForReview(versionId);
    revalidatePath(`/app/processes/${processId}`);
    return `/app/processes/${processId}`;
  });
}

export async function approveVersionAction(processId: string, versionId: string): Promise<void> {
  await runFormAction(`/app/processes/${processId}`, async () => {
    await approveVersion(versionId);
    revalidatePath(`/app/processes/${processId}`);
    return `/app/processes/${processId}`;
  });
}

export async function publishVersionAction(processId: string, versionId: string): Promise<void> {
  await runFormAction(`/app/processes/${processId}`, async () => {
    await publishVersion(versionId);
    revalidatePath("/app/processes");
    revalidatePath(`/app/processes/${processId}`);
    return `/app/processes/${processId}`;
  });
}

export async function rejectReviewAction(
  processId: string,
  versionId: string,
  formData: FormData,
): Promise<void> {
  await runFormAction(`/app/processes/${processId}`, async () => {
    await rejectReview(versionId, String(formData.get("reviewNotes") ?? ""));
    revalidatePath(`/app/processes/${processId}`);
    return `/app/processes/${processId}`;
  });
}
