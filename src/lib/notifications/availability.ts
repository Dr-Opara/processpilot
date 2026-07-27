import "server-only";

/**
 * Whether the email adapter has a real, usable credential — same
 * "distinguish unconfigured from disabled" posture and literal-
 * placeholder-value check as src/lib/ai/availability.ts's
 * isAiConfigured(), applied to EMAIL_PROVIDER_API_KEY (see
 * docs/development/environment-variables.md and .env.local's
 * `EMAIL_PROVIDER_API_KEY=replace-me` placeholder). Every caller checks
 * this before reaching the provider so an unconfigured environment
 * fails safely — a delivery is recorded as
 * `skipped_not_configured`, never a fabricated success.
 */
const PLACEHOLDER_MARKERS = ["replace-me", "replace_me", "changeme", "your-key-here", "xxxxxxxx"];

export function isEmailConfigured(): boolean {
  const key = process.env.EMAIL_PROVIDER_API_KEY;
  const from = process.env.EMAIL_FROM_ADDRESS;
  if (!key || !key.trim() || !from || !from.trim()) return false;
  const lowered = key.toLowerCase();
  return !PLACEHOLDER_MARKERS.some((marker) => lowered.includes(marker));
}

export function getEmailProviderApiKey(): string {
  if (!isEmailConfigured()) {
    throw new Error(
      "EMAIL_PROVIDER_API_KEY is not configured — call isEmailConfigured() before invoking the email adapter.",
    );
  }
  return process.env.EMAIL_PROVIDER_API_KEY as string;
}

export function getEmailFromAddress(): string {
  if (!isEmailConfigured()) {
    throw new Error(
      "EMAIL_FROM_ADDRESS is not configured — call isEmailConfigured() before invoking the email adapter.",
    );
  }
  return process.env.EMAIL_FROM_ADDRESS as string;
}
