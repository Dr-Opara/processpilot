import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/** HMAC-SHA256 over the raw JSON payload string, hex-encoded — sent as the `X-ProcessPilot-Signature` header on every outbound delivery (src/lib/jobs/webhook-handlers.ts) so a receiving endpoint can verify authenticity. */
export function signWebhookPayload(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyWebhookSignature(
  secret: string,
  payload: string,
  signature: string,
): boolean {
  const expected = signWebhookPayload(secret, payload);
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(signature, "hex");
  return (
    expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer)
  );
}
