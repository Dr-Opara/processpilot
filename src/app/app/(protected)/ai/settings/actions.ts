"use server";

import { revalidatePath } from "next/cache";
import { runFormAction } from "@/lib/form-actions";
import { setAiCopilotEnabled } from "@/lib/services/ai-settings";

export async function setAiCopilotEnabledAction(formData: FormData): Promise<void> {
  await runFormAction("/app/ai/settings", async () => {
    await setAiCopilotEnabled(formData.get("enabled") === "on");
    revalidatePath("/app/ai/settings");
    revalidatePath("/app/ai");
    return "/app/ai/settings";
  });
}
