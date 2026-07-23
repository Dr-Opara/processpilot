"use server";

import { revalidatePath } from "next/cache";
import { advanceOnboardingStep, updateCompanyProfile } from "@/lib/services/organizations";
import type { OnboardingStep } from "@/lib/db/database.types";
import { runFormAction } from "@/lib/form-actions";

export async function advanceOnboardingStepAction(step: OnboardingStep): Promise<void> {
  await runFormAction("/app/onboarding", async () => {
    await advanceOnboardingStep(step);
    revalidatePath("/app/onboarding");
    return "/app/onboarding";
  });
}

export async function saveCompanyProfileAction(formData: FormData): Promise<void> {
  await runFormAction("/app/onboarding", async () => {
    await updateCompanyProfile({
      name: String(formData.get("name") ?? ""),
      legalName: String(formData.get("legalName") ?? "") || null,
      slug: String(formData.get("slug") ?? ""),
      industry: String(formData.get("industry") ?? "") || null,
      employeeCountRange: String(formData.get("employeeCountRange") ?? "") || null,
      websiteUrl: String(formData.get("websiteUrl") ?? ""),
      country: String(formData.get("country") ?? "") || null,
      timezone: String(formData.get("timezone") ?? ""),
      dateFormat: String(formData.get("dateFormat") ?? ""),
      weekStart: String(formData.get("weekStart") ?? "monday") as "sunday" | "monday",
      primaryUseCase: String(formData.get("primaryUseCase") ?? "") || null,
    });
    await advanceOnboardingStep("locations");
    revalidatePath("/app/onboarding");
    return "/app/onboarding";
  });
}
