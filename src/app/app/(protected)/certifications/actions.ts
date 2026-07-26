"use server";

import { revalidatePath } from "next/cache";
import { runFormAction } from "@/lib/form-actions";
import { renewCertification, revokeCertification } from "@/lib/services/certifications";

export async function renewCertificationAction(
  certificationId: string,
  formData: FormData,
): Promise<void> {
  await runFormAction("/app/certifications", async () => {
    const newExpiresAtRaw = String(formData.get("newExpiresAt") ?? "");
    await renewCertification(
      certificationId,
      newExpiresAtRaw ? new Date(newExpiresAtRaw).toISOString() : null,
    );
    revalidatePath("/app/certifications");
    return "/app/certifications";
  });
}

export async function revokeCertificationAction(
  certificationId: string,
  formData: FormData,
): Promise<void> {
  await runFormAction("/app/certifications", async () => {
    await revokeCertification(certificationId, String(formData.get("reason") ?? ""));
    revalidatePath("/app/certifications");
    return "/app/certifications";
  });
}
