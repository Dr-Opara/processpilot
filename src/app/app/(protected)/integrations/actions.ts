"use server";

import { revalidatePath } from "next/cache";
import { runFormAction } from "@/lib/form-actions";
import {
  connectWithApiKey,
  disconnectIntegration,
  getConnectAuthorizationUrl,
  verifyIntegration,
} from "@/lib/services/integration-connections";
import type { IntegrationProviderKey } from "@/lib/db/database.types";

function absoluteUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.processpilot.com";
  return `${base}${path}`;
}

export async function connectOAuthAction(formData: FormData): Promise<void> {
  await runFormAction("/app/integrations", async () => {
    const provider = String(formData.get("provider")) as IntegrationProviderKey;
    const redirectUri = absoluteUrl(`/api/integrations/oauth/${provider}/callback`);
    return getConnectAuthorizationUrl(provider, redirectUri);
  });
}

export async function connectApiKeyAction(formData: FormData): Promise<void> {
  await runFormAction("/app/integrations", async () => {
    const provider = String(formData.get("provider")) as IntegrationProviderKey;
    const apiKey = String(formData.get("apiKey") ?? "");
    await connectWithApiKey(provider, apiKey);
    revalidatePath("/app/integrations");
    return "/app/integrations";
  });
}

export async function disconnectIntegrationAction(provider: IntegrationProviderKey): Promise<void> {
  await runFormAction("/app/integrations", async () => {
    await disconnectIntegration(provider);
    revalidatePath("/app/integrations");
    return "/app/integrations";
  });
}

export async function verifyIntegrationAction(provider: IntegrationProviderKey): Promise<void> {
  await runFormAction("/app/integrations", async () => {
    await verifyIntegration(provider);
    revalidatePath("/app/integrations");
    return "/app/integrations";
  });
}
