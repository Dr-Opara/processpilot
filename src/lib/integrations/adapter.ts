import "server-only";
import type { IntegrationProviderKey } from "@/lib/db/database.types";

/**
 * Provider-neutral integration adapter — mirrors src/lib/ai/adapter.ts,
 * src/lib/notifications/adapter.ts, and src/lib/billing/adapter.ts's
 * pattern. Every connection/verification action goes through the
 * registered IntegrationAdapter for a provider, never a vendor SDK
 * called directly from a service or route handler.
 *
 * Deliberately minimal: OAuth authorization-url/code-exchange and a
 * single verifyConnection() health check are the only capabilities
 * every provider must support to appear in the catalog. Provider-
 * specific actions (posting a Slack message, creating a Jira issue,
 * ...) are out of scope for this phase's adapter surface — see
 * docs/architecture/integration-architecture.md's known gaps. This
 * keeps the interface honest: it only promises what every listed
 * provider actually implements today.
 */
export interface IntegrationCredentials {
  accessToken?: string;
  refreshToken?: string;
  apiKey?: string;
  /** ISO 8601 — when accessToken expires, for OAuth2 providers that issue one. */
  expiresAt?: string;
}

export interface VerifyConnectionResult {
  ok: boolean;
  /** A human-readable label for what got connected (e.g. a Slack workspace name), shown in the admin UI. */
  accountLabel?: string;
  error?: string;
}

export interface IntegrationAdapter {
  readonly provider: IntegrationProviderKey;
  readonly authType: "oauth2" | "api_key";
  readonly displayName: string;
  readonly description: string;
  /** True once this adapter has a real implementation (not just a catalog placeholder) — see NotImplementedProvider. */
  readonly implemented: boolean;

  /** OAuth2 providers only. */
  getAuthorizationUrl?(state: string, redirectUri: string): string;
  /** OAuth2 providers only. */
  exchangeCodeForCredentials?(code: string, redirectUri: string): Promise<IntegrationCredentials>;

  /** Every adapter implements this — verifies the stored credentials actually work against the real provider, used both right after connecting and for periodic connection-health checks. */
  verifyConnection(credentials: IntegrationCredentials): Promise<VerifyConnectionResult>;
}
