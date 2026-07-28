import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Slack's actual inbound-webhook signing scheme ("Verifying requests
 * from Slack" — v0): HMAC-SHA256 over `v0:{timestamp}:{rawBody}`,
 * keyed by the app's signing secret, hex-encoded and prefixed `v0=`.
 * The 5-minute timestamp window is replay protection, independent of
 * inbound_webhook_events' event-id dedupe (the two guard against
 * different things: a replayed-but-otherwise-valid old request vs. a
 * duplicate delivery of the same, still-fresh event).
 */
const MAX_CLOCK_SKEW_SECONDS = 60 * 5;

export function isSlackSignatureConfigured(): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET;
  return Boolean(secret && secret.trim() && !secret.toLowerCase().includes("replace"));
}

export function verifySlackSignature(
  rawBody: string,
  timestamp: string,
  signature: string,
): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > MAX_CLOCK_SKEW_SECONDS) return false;

  const basestring = `v0:${timestamp}:${rawBody}`;
  const expected = `v0=${createHmac("sha256", secret).update(basestring).digest("hex")}`;
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  return (
    expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer)
  );
}
