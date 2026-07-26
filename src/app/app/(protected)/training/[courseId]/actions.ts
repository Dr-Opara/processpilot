"use server";

import { revalidatePath } from "next/cache";
import { runFormAction } from "@/lib/form-actions";
import { createDraftCourseVersion, publishCourseVersion } from "@/lib/services/training-courses";
import { assignTraining } from "@/lib/services/training-assignments";

export async function createDraftCourseVersionAction(
  courseId: string,
  formData: FormData,
): Promise<void> {
  await runFormAction(`/app/training/${courseId}`, async () => {
    const hasAssessment = formData.get("hasAssessment") === "on";
    const rawQuestions = String(formData.get("assessmentQuestions") ?? "[]").trim();
    await createDraftCourseVersion(courseId, {
      title: String(formData.get("title") ?? ""),
      content: String(formData.get("content") ?? ""),
      hasAssessment,
      assessmentQuestions: hasAssessment ? JSON.parse(rawQuestions || "[]") : [],
      passingScorePercent: hasAssessment
        ? Number(formData.get("passingScorePercent") ?? 0)
        : undefined,
    });
    revalidatePath(`/app/training/${courseId}`);
    return `/app/training/${courseId}`;
  });
}

export async function publishCourseVersionAction(
  courseId: string,
  versionId: string,
): Promise<void> {
  await runFormAction(`/app/training/${courseId}`, async () => {
    await publishCourseVersion(versionId);
    revalidatePath(`/app/training/${courseId}`);
    return `/app/training/${courseId}`;
  });
}

export async function assignTrainingAction(courseId: string, formData: FormData): Promise<void> {
  await runFormAction(`/app/training/${courseId}`, async () => {
    const dueAtRaw = String(formData.get("dueAt") ?? "");
    await assignTraining({
      courseVersionId: String(formData.get("courseVersionId") ?? ""),
      assignedVia: String(formData.get("assignedVia") ?? "individual") as
        "individual" | "role" | "department" | "team",
      targetId: String(formData.get("targetId") ?? ""),
      dueAt: dueAtRaw ? new Date(dueAtRaw).toISOString() : undefined,
    });
    revalidatePath(`/app/training/${courseId}`);
    return `/app/training/${courseId}`;
  });
}
