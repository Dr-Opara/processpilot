import { NextResponse, type NextRequest } from "next/server";
import { handleOAuthCallback } from "@/lib/services/integration-connections";
import { toSafeErrorResponse } from "@/lib/errors";
import type { IntegrationProviderKey } from "@/lib/db/database.types";

/**
 * The OAuth2 redirect target for every implemented provider — a
 * signed-`state`-verified callback (src/lib/integrations/oauth-state.ts),
 * not a session-based one, since the redirect comes from the
 * provider's own domain. Redirects back to /app/integrations either
 * way (success or failure) — an OAuth callback is never itself a
 * page a user reads, it's a hop.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const redirectUri = `${url.origin}${url.pathname}`;

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/app/integrations?error=Missing+authorization+code+or+state", url.origin),
    );
  }

  try {
    await handleOAuthCallback(provider as IntegrationProviderKey, code, state, redirectUri);
    return NextResponse.redirect(new URL("/app/integrations?connected=true", url.origin));
  } catch (error) {
    const { body } = toSafeErrorResponse(error);
    return NextResponse.redirect(
      new URL(`/app/integrations?error=${encodeURIComponent(body.error)}`, url.origin),
    );
  }
}
