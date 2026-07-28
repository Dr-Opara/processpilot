import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Application-layer encryption for third-party credentials
 * (integration_connections.encrypted_credentials,
 * webhook_subscriptions.encrypted_secret) — AES-256-GCM, so the
 * plaintext never reaches the database even though the database
 * itself is also protected by RLS/TLS. `INTEGRATION_ENCRYPTION_KEY` is
 * a base64-encoded 32-byte key, server-only, never committed (see
 * environment-variables.md). Ciphertext is stored as
 * `base64(iv) + "." + base64(authTag) + "." + base64(ciphertext)` —
 * three dot-separated fields rather than one concatenated blob, so a
 * malformed/truncated value fails fast and legibly instead of
 * decrypting to garbage.
 */
const IV_LENGTH = 12;

function getKey(): Buffer {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!raw || !raw.trim()) {
    throw new Error(
      "INTEGRATION_ENCRYPTION_KEY is not configured — call isEncryptionConfigured() before encrypting/decrypting a secret.",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("INTEGRATION_ENCRYPTION_KEY must decode to exactly 32 bytes (AES-256).");
  }
  return key;
}

export function isEncryptionConfigured(): boolean {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!raw || !raw.trim()) return false;
  try {
    return Buffer.from(raw, "base64").length === 32;
  } catch {
    return false;
  }
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${authTag.toString("base64")}.${ciphertext.toString("base64")}`;
}

export function decryptSecret(encoded: string): string {
  const key = getKey();
  const parts = encoded.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted secret — expected iv.authTag.ciphertext.");
  }
  const [ivB64, authTagB64, ciphertextB64] = parts;
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
