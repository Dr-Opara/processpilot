import "server-only";

/**
 * Whether the AI adapter has a real, usable credential — distinct from
 * whether an organization has *enabled* the copilot (see
 * src/lib/services/ai-settings.ts's org-level `ai_copilot_enabled`
 * feature flag). Every ai-*.ts service checks both before calling the
 * adapter, so "AI not configured" (an environment/ops concern) and "AI
 * disabled for this organization" (a tenant admin's choice) are always
 * distinguishable to the caller rather than collapsing into one generic
 * failure.
 *
 * Deliberately checks for the literal placeholder value
 * docs/development/environment-variables.md documents
 * (`ANTHROPIC_API_KEY=sk-ant-replace-me` in `.env.local.example`), not
 * just "the variable is set" — a copied-but-unedited `.env.local` must
 * read as unconfigured, not silently attempt a doomed API call.
 */
const PLACEHOLDER_MARKERS = ["replace-me", "replace_me", "changeme", "your-key-here", "xxxxxxxx"];

export function isAiConfigured(): boolean {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || !key.trim()) return false;
  const lowered = key.toLowerCase();
  return !PLACEHOLDER_MARKERS.some((marker) => lowered.includes(marker));
}

export function getAnthropicApiKey(): string {
  if (!isAiConfigured()) {
    throw new Error(
      "ANTHROPIC_API_KEY is not configured — call isAiConfigured() before invoking the AI adapter.",
    );
  }
  return process.env.ANTHROPIC_API_KEY as string;
}
