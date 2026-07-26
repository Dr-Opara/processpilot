import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

import { isAiConfigured, getAnthropicApiKey } from "./availability";

const ORIGINAL_KEY = process.env.ANTHROPIC_API_KEY;

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = ORIGINAL_KEY;
});

describe("isAiConfigured", () => {
  it("is false when the key is missing", () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(isAiConfigured()).toBe(false);
  });

  it("is false when the key is empty", () => {
    process.env.ANTHROPIC_API_KEY = "   ";
    expect(isAiConfigured()).toBe(false);
  });

  it("is false for the documented .env.local.example placeholder", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-replace-me";
    expect(isAiConfigured()).toBe(false);
  });

  it("is true for a key that doesn't match a known placeholder pattern", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-api03-real-looking-value";
    expect(isAiConfigured()).toBe(true);
  });
});

describe("getAnthropicApiKey", () => {
  it("throws when not configured", () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(() => getAnthropicApiKey()).toThrow();
  });

  it("returns the key when configured", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-api03-real-looking-value";
    expect(getAnthropicApiKey()).toBe("sk-ant-api03-real-looking-value");
  });
});
