"use server";

import { revalidatePath } from "next/cache";
import { runFormAction } from "@/lib/form-actions";
import { createApiKey, revokeApiKey, type ApiKeyScope } from "@/lib/services/api-keys";

export async function createApiKeyAction(formData: FormData): Promise<void> {
  await runFormAction("/app/integrations/api-keys", async () => {
    const scopes = formData.getAll("scopes").map(String) as ApiKeyScope[];
    const created = await createApiKey({
      name: String(formData.get("name") ?? ""),
      scopes,
    });
    revalidatePath("/app/integrations/api-keys");
    return `/app/integrations/api-keys?newKey=${encodeURIComponent(created.rawKey)}`;
  });
}

export async function revokeApiKeyAction(keyId: string): Promise<void> {
  await runFormAction("/app/integrations/api-keys", async () => {
    await revokeApiKey(keyId);
    revalidatePath("/app/integrations/api-keys");
    return "/app/integrations/api-keys";
  });
}
