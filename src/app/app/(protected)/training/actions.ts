"use server";

import { revalidatePath } from "next/cache";
import { runFormAction } from "@/lib/form-actions";
import { createTrainingCourse, trainingCourseInputSchema } from "@/lib/services/training-courses";

export async function createTrainingCourseAction(formData: FormData): Promise<void> {
  await runFormAction("/app/training/new", async () => {
    const input = trainingCourseInputSchema.parse({
      title: String(formData.get("title") ?? ""),
      description: String(formData.get("description") ?? "") || undefined,
      category: String(formData.get("category") ?? "") || undefined,
    });
    const course = await createTrainingCourse(input);
    revalidatePath("/app/training");
    return `/app/training/${course.id}`;
  });
}
