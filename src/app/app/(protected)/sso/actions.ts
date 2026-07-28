"use server";

import { revalidatePath } from "next/cache";
import { runFormAction } from "@/lib/form-actions";
import {
  createSsoConnection,
  deleteSsoConnection,
  setSsoConnectionActive,
  type CreateSsoConnectionInput,
} from "@/lib/services/sso";

export async function createSsoConnectionAction(formData: FormData): Promise<void> {
  await runFormAction("/app/sso", async () => {
    const provider = String(formData.get("provider"));
    const input: CreateSsoConnectionInput = {
      name: String(formData.get("name") ?? ""),
      domain: String(formData.get("domain") ?? ""),
      provider: provider === "oidc_custom" ? "oidc_custom" : "saml_custom",
      saml:
        provider === "saml_custom"
          ? {
              idpEntityId: String(formData.get("idpEntityId") ?? ""),
              idpSsoUrl: String(formData.get("idpSsoUrl") ?? ""),
              idpCertificate: String(formData.get("idpCertificate") ?? "") || undefined,
              idpMetadataUrl: String(formData.get("idpMetadataUrl") ?? "") || undefined,
            }
          : undefined,
      oidc:
        provider === "oidc_custom"
          ? {
              clientId: String(formData.get("clientId") ?? ""),
              clientSecret: String(formData.get("clientSecret") ?? ""),
              discoveryUrl: String(formData.get("discoveryUrl") ?? ""),
            }
          : undefined,
    };
    await createSsoConnection(input);
    revalidatePath("/app/sso");
    return "/app/sso";
  });
}

export async function setSsoConnectionActiveAction(
  connectionId: string,
  active: boolean,
): Promise<void> {
  await runFormAction("/app/sso", async () => {
    await setSsoConnectionActive(connectionId, active);
    revalidatePath("/app/sso");
    return "/app/sso";
  });
}

export async function deleteSsoConnectionAction(connectionId: string): Promise<void> {
  await runFormAction("/app/sso", async () => {
    await deleteSsoConnection(connectionId);
    revalidatePath("/app/sso");
    return "/app/sso";
  });
}
