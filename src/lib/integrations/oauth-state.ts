import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Self-contained, signed OAuth `state` parameter — no server-side
 * session storage needed (serverless route handlers can't reliably
 * share in-memory state between the authorize redirect and the
 * callback request). Binds the state to the initiating organization
 * and provider, and expires after 10 minutes, so a captured/replayed
 * state can't be reused later or against a different organization —
 * the CSRF-protection property an OAuth `state` parameter exists for.
 */
const MAX_AGE_MS = 10 * 60_000;

function getSecret(): Buffer {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!raw || !raw.trim()) {
    throw new Error("INTEGRATION_ENCRYPTION_KEY is not configured — cannot sign an OAuth state.");
  }
  return Buffer.from(raw, "base64");
}

export function createOAuthState(organizationId: string, provider: string): string {
  const nonce = randomBytes(8).toString("hex");
  const timestamp = Date.now().toString();
  const payload = `${organizationId}.${provider}.${timestamp}.${nonce}`;
  // This is an HMAC integrity signature over a CSRF-state payload, not
  // password/credential storage — see verifyOAuthState() below, which
  // recomputes this same signature to check it.
  // codeql[js/insufficient-password-hash]: HMAC-SHA256 is the correct, standard primitive for signing; a slow KDF would be actively wrong here.
  const signature = createHmac("sha256", getSecret()).update(payload).digest("hex");
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

export interface OAuthStatePayload {
  organizationId: string;
  provider: string;
}

/** Returns null for any malformed, expired, mismatched-signature, or wrong-provider state — callers treat any null as "reject the callback." */
export function verifyOAuthState(
  state: string,
  expectedProvider: string,
): OAuthStatePayload | null {
  let decoded: string;
  try {
    decoded = Buffer.from(state, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const parts = decoded.split(".");
  if (parts.length !== 5) return null;
  const [organizationId, provider, timestamp, nonce, signature] = parts;

  const payload = `${organizationId}.${provider}.${timestamp}.${nonce}`;
  // Same HMAC integrity signature as createOAuthState() above — see
  // that function's comment for why this isn't password hashing.
  // codeql[js/insufficient-password-hash]: HMAC-SHA256 is the correct, standard primitive for signing; a slow KDF would be actively wrong here.
  const expectedSignature = createHmac("sha256", getSecret()).update(payload).digest("hex");
  const signatureBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  if (provider !== expectedProvider) return null;
  const age = Date.now() - Number(timestamp);
  if (!Number.isFinite(age) || age < 0 || age > MAX_AGE_MS) return null;

  return { organizationId, provider };
}
