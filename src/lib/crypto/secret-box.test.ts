import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

import { decryptSecret, encryptSecret, isEncryptionConfigured } from "./secret-box";

const ORIGINAL_KEY = process.env.INTEGRATION_ENCRYPTION_KEY;
const TEST_KEY = Buffer.alloc(32, 7).toString("base64");

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEY;
  else process.env.INTEGRATION_ENCRYPTION_KEY = ORIGINAL_KEY;
});

describe("isEncryptionConfigured", () => {
  it("is false when unset", () => {
    delete process.env.INTEGRATION_ENCRYPTION_KEY;
    expect(isEncryptionConfigured()).toBe(false);
  });

  it("is false when the key doesn't decode to 32 bytes", () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = Buffer.alloc(16).toString("base64");
    expect(isEncryptionConfigured()).toBe(false);
  });

  it("is true for a valid 32-byte base64 key", () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = TEST_KEY;
    expect(isEncryptionConfigured()).toBe(true);
  });
});

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a plaintext value", () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = TEST_KEY;
    const ciphertext = encryptSecret("xoxb-super-secret-token");
    expect(ciphertext).not.toContain("xoxb-super-secret-token");
    expect(decryptSecret(ciphertext)).toBe("xoxb-super-secret-token");
  });

  it("produces a different ciphertext each time (random IV)", () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = TEST_KEY;
    expect(encryptSecret("same-value")).not.toBe(encryptSecret("same-value"));
  });

  it("throws on a tampered ciphertext rather than returning garbage", () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = TEST_KEY;
    const ciphertext = encryptSecret("xoxb-super-secret-token");
    const [iv, authTag, body] = ciphertext.split(".");
    const tampered = `${iv}.${authTag}.${Buffer.from("garbage").toString("base64")}${body.slice(-4)}`;
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("throws without a configured key", () => {
    delete process.env.INTEGRATION_ENCRYPTION_KEY;
    expect(() => encryptSecret("value")).toThrow();
  });
});
