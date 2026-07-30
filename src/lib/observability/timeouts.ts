/**
 * Phase 23: a single, shared timeout budget for every raw `fetch()` call
 * to an external provider in this codebase (Slack, Resend, outbound
 * webhooks — the AI/Stripe SDKs have their own built-in timeout
 * handling and aren't affected). Before this phase, none of these calls
 * had any timeout at all — a hung provider connection could tie up a
 * worker/route handler indefinitely. `AbortSignal.timeout()` is a
 * standard, dependency-free way to bound any fetch call.
 */
export const EXTERNAL_REQUEST_TIMEOUT_MS = 10_000;

export function externalRequestSignal(): AbortSignal {
  return AbortSignal.timeout(EXTERNAL_REQUEST_TIMEOUT_MS);
}
