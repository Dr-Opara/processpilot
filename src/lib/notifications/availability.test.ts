import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

import { getEmailFromAddress, getEmailProviderApiKey, isEmailConfigured } from "./availability";

const ORIGINAL_KEY = process.env.EMAIL_PROVIDER_API_KEY;
const ORIGINAL_FROM = process.env.EMAIL_FROM_ADDRESS;

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.EMAIL_PROVIDER_API_KEY;
  else process.env.EMAIL_PROVIDER_API_KEY = ORIGINAL_KEY;
  if (ORIGINAL_FROM === undefined) delete process.env.EMAIL_FROM_ADDRESS;
  else process.env.EMAIL_FROM_ADDRESS = ORIGINAL_FROM;
});

describe("isEmailConfigured", () => {
  it("is false when the key is missing", () => {
    delete process.env.EMAIL_PROVIDER_API_KEY;
    process.env.EMAIL_FROM_ADDRESS = "no-reply@example.com";
    expect(isEmailConfigured()).toBe(false);
  });

  it("is false when the from address is missing", () => {
    process.env.EMAIL_PROVIDER_API_KEY = "re_real_looking_value";
    delete process.env.EMAIL_FROM_ADDRESS;
    expect(isEmailConfigured()).toBe(false);
  });

  it("is false for the documented .env.local placeholder", () => {
    process.env.EMAIL_PROVIDER_API_KEY = "replace-me";
    process.env.EMAIL_FROM_ADDRESS = "no-reply@example.com";
    expect(isEmailConfigured()).toBe(false);
  });

  it("is true for a key that doesn't match a known placeholder pattern", () => {
    process.env.EMAIL_PROVIDER_API_KEY = "re_real_looking_value";
    process.env.EMAIL_FROM_ADDRESS = "no-reply@example.com";
    expect(isEmailConfigured()).toBe(true);
  });
});

describe("getEmailProviderApiKey / getEmailFromAddress", () => {
  it("throws when not configured", () => {
    delete process.env.EMAIL_PROVIDER_API_KEY;
    delete process.env.EMAIL_FROM_ADDRESS;
    expect(() => getEmailProviderApiKey()).toThrow();
    expect(() => getEmailFromAddress()).toThrow();
  });

  it("returns the configured values", () => {
    process.env.EMAIL_PROVIDER_API_KEY = "re_real_looking_value";
    process.env.EMAIL_FROM_ADDRESS = "no-reply@example.com";
    expect(getEmailProviderApiKey()).toBe("re_real_looking_value");
    expect(getEmailFromAddress()).toBe("no-reply@example.com");
  });
});
