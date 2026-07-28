import "server-only";
import type {
  IntegrationAdapter,
  IntegrationCredentials,
  VerifyConnectionResult,
} from "@/lib/integrations/adapter";

/**
 * The one fully-implemented integration adapter in this phase's
 * catalog — Slack, chosen as the reference implementation for the
 * OAuth2 connection pattern (standard "OAuth v2" authorize/exchange
 * flow, well-documented, no SDK dependency needed for the two calls
 * this adapter makes). Direct `fetch` to Slack's Web API, same "no new
 * dependency for a narrow integration" posture as the email adapter's
 * Resend provider.
 *
 * SLACK_CLIENT_ID/SLACK_CLIENT_SECRET are unconfigured (placeholder)
 * in this environment — see isSlackConfigured(). Live OAuth exchange
 * and connection verification are unverified end-to-end until real
 * credentials are supplied.
 */
const PLACEHOLDER_MARKERS = ["replace-me", "replace_me", "changeme", "your-", "xxxxxxxx"];

export function isSlackConfigured(): boolean {
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  if (!clientId || !clientId.trim() || !clientSecret || !clientSecret.trim()) return false;
  const lowered = clientSecret.toLowerCase();
  return !PLACEHOLDER_MARKERS.some((marker) => lowered.includes(marker));
}

function requireSlackCredentials(): { clientId: string; clientSecret: string } {
  if (!isSlackConfigured()) {
    throw new Error(
      "SLACK_CLIENT_ID/SLACK_CLIENT_SECRET are not configured — call isSlackConfigured() before invoking the Slack adapter.",
    );
  }
  return {
    clientId: process.env.SLACK_CLIENT_ID as string,
    clientSecret: process.env.SLACK_CLIENT_SECRET as string,
  };
}

const SLACK_SCOPES = ["chat:write", "channels:read"];

export class SlackProvider implements IntegrationAdapter {
  readonly provider = "slack" as const;
  readonly authType = "oauth2" as const;
  readonly displayName = "Slack";
  readonly description = "Post workflow, exception, and approval notifications to a Slack channel.";
  readonly implemented = true;

  getAuthorizationUrl(state: string, redirectUri: string): string {
    const { clientId } = requireSlackCredentials();
    const params = new URLSearchParams({
      client_id: clientId,
      scope: SLACK_SCOPES.join(","),
      redirect_uri: redirectUri,
      state,
    });
    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  async exchangeCodeForCredentials(
    code: string,
    redirectUri: string,
  ): Promise<IntegrationCredentials> {
    const { clientId, clientSecret } = requireSlackCredentials();
    const response = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    const result = (await response.json()) as {
      ok: boolean;
      access_token?: string;
      error?: string;
    };
    if (!response.ok || !result.ok || !result.access_token) {
      throw new Error(`Slack OAuth exchange failed: ${result.error ?? response.statusText}`);
    }
    return { accessToken: result.access_token };
  }

  async verifyConnection(credentials: IntegrationCredentials): Promise<VerifyConnectionResult> {
    if (!credentials.accessToken) return { ok: false, error: "No access token on file." };
    try {
      const response = await fetch("https://slack.com/api/auth.test", {
        method: "POST",
        headers: { Authorization: `Bearer ${credentials.accessToken}` },
      });
      const result = (await response.json()) as { ok: boolean; team?: string; error?: string };
      if (!result.ok) return { ok: false, error: result.error ?? "Slack rejected the token." };
      return { ok: true, accountLabel: result.team };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Unknown error." };
    }
  }
}
