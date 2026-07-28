import "server-only";
import type {
  IntegrationAdapter,
  IntegrationCredentials,
  VerifyConnectionResult,
} from "@/lib/integrations/adapter";
import type { IntegrationProviderKey } from "@/lib/db/database.types";

/**
 * A catalog-only placeholder — lists a provider (so admins can see
 * it's a planned integration) without claiming it can actually be
 * connected. Every method throws rather than pretending to succeed:
 * per this phase's explicit "no fake successful connections"
 * requirement, a provider with no real adapter must fail loudly, not
 * silently no-op.
 */
export class NotImplementedProvider implements IntegrationAdapter {
  readonly authType: "oauth2" | "api_key" = "oauth2";
  readonly implemented = false;

  constructor(
    readonly provider: IntegrationProviderKey,
    readonly displayName: string,
    readonly description: string,
  ) {}

  getAuthorizationUrl(): never {
    throw new Error(`${this.displayName} is not yet implemented — connecting is not available.`);
  }

  exchangeCodeForCredentials(): Promise<IntegrationCredentials> {
    throw new Error(`${this.displayName} is not yet implemented — connecting is not available.`);
  }

  async verifyConnection(): Promise<VerifyConnectionResult> {
    return { ok: false, error: `${this.displayName} is not yet implemented.` };
  }
}
