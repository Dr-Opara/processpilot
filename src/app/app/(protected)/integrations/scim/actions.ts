"use server";

import { revalidatePath } from "next/cache";
import { createScimToken, revokeScimToken } from "@/lib/services/scim";
import { runFormAction } from "@/lib/form-actions";

export async function createScimTokenAction(formData: FormData): Promise<void> {
  await runFormAction("/app/integrations/scim", async () => {
    const { rawToken } = await createScimToken({ name: String(formData.get("name") ?? "") });
    revalidatePath("/app/integrations/scim");
    return `/app/integrations/scim?newToken=${encodeURIComponent(rawToken)}`;
  });
}

export async function revokeScimTokenAction(tokenId: string): Promise<void> {
  await revokeScimToken(tokenId);
  revalidatePath("/app/integrations/scim");
}
