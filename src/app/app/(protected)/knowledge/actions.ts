"use server";

import { revalidatePath } from "next/cache";
import {
  archiveDocument,
  createDocument,
  restoreDocument,
} from "@/lib/services/knowledge-documents";
import {
  approveAndPublish,
  createAuthoredVersion,
  createUploadedVersion,
  rejectReview,
  submitForReview,
  updateDraftVersion,
} from "@/lib/services/document-versions";
import { runFormAction } from "@/lib/form-actions";

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export async function createDocumentAction(formData: FormData): Promise<void> {
  await runFormAction("/app/knowledge/new", async () => {
    const title = String(formData.get("title") ?? "");
    const mode = String(formData.get("mode") ?? "author");

    const document = await createDocument({
      title,
      category: String(formData.get("category") ?? "") || null,
      tags: parseTags(String(formData.get("tags") ?? "")),
      ownerMemberId: String(formData.get("ownerMemberId") ?? "") || null,
      departmentId: String(formData.get("departmentId") ?? "") || null,
    });

    if (mode === "upload") {
      const file = formData.get("file");
      if (!(file instanceof File) || file.size === 0) {
        throw new Error("A file is required when uploading a document.");
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      await createUploadedVersion(document.id, title, { buffer, filename: file.name });
    } else {
      const content = String(formData.get("content") ?? "");
      await createAuthoredVersion({ documentId: document.id, title, content });
    }

    revalidatePath("/app/knowledge");
    return `/app/knowledge/${document.id}`;
  });
}

export async function archiveDocumentAction(documentId: string): Promise<void> {
  await archiveDocument(documentId);
  revalidatePath("/app/knowledge");
  revalidatePath(`/app/knowledge/${documentId}`);
}

export async function restoreDocumentAction(documentId: string): Promise<void> {
  await restoreDocument(documentId);
  revalidatePath("/app/knowledge");
  revalidatePath(`/app/knowledge/${documentId}`);
}

export async function updateDraftVersionAction(
  documentId: string,
  versionId: string,
  formData: FormData,
): Promise<void> {
  await runFormAction(`/app/knowledge/${documentId}/edit`, async () => {
    await updateDraftVersion(versionId, {
      title: String(formData.get("title") ?? ""),
      content: String(formData.get("content") ?? ""),
    });
    revalidatePath(`/app/knowledge/${documentId}`);
    return `/app/knowledge/${documentId}`;
  });
}

export async function createNewVersionAction(
  documentId: string,
  formData: FormData,
): Promise<void> {
  await runFormAction(`/app/knowledge/${documentId}`, async () => {
    const title = String(formData.get("title") ?? "");
    const mode = String(formData.get("mode") ?? "author");

    if (mode === "upload") {
      const file = formData.get("file");
      if (!(file instanceof File) || file.size === 0) {
        throw new Error("A file is required when uploading a document.");
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      await createUploadedVersion(documentId, title, { buffer, filename: file.name });
    } else {
      const content = String(formData.get("content") ?? "");
      await createAuthoredVersion({ documentId, title, content });
    }

    revalidatePath(`/app/knowledge/${documentId}`);
    return `/app/knowledge/${documentId}`;
  });
}

export async function submitForReviewAction(documentId: string, versionId: string): Promise<void> {
  await runFormAction(`/app/knowledge/${documentId}`, async () => {
    await submitForReview(versionId);
    revalidatePath(`/app/knowledge/${documentId}`);
    return `/app/knowledge/${documentId}`;
  });
}

export async function approveAndPublishAction(
  documentId: string,
  versionId: string,
): Promise<void> {
  await runFormAction(`/app/knowledge/${documentId}`, async () => {
    await approveAndPublish(versionId);
    revalidatePath("/app/knowledge");
    revalidatePath(`/app/knowledge/${documentId}`);
    return `/app/knowledge/${documentId}`;
  });
}

export async function rejectReviewAction(
  documentId: string,
  versionId: string,
  formData: FormData,
): Promise<void> {
  await runFormAction(`/app/knowledge/${documentId}`, async () => {
    await rejectReview(versionId, String(formData.get("reviewNotes") ?? ""));
    revalidatePath(`/app/knowledge/${documentId}`);
    return `/app/knowledge/${documentId}`;
  });
}
