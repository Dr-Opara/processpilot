import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { isAllowedWebhookUrl } from "./ssrf-guard";

describe("isAllowedWebhookUrl", () => {
  it("allows a normal https URL", () => {
    expect(isAllowedWebhookUrl("https://example.com/webhook").allowed).toBe(true);
  });

  it("rejects http (non-https)", () => {
    expect(isAllowedWebhookUrl("http://example.com/webhook").allowed).toBe(false);
  });

  it("rejects localhost", () => {
    expect(isAllowedWebhookUrl("https://localhost/webhook").allowed).toBe(false);
  });

  it("rejects loopback and private IPv4 ranges", () => {
    expect(isAllowedWebhookUrl("https://127.0.0.1/webhook").allowed).toBe(false);
    expect(isAllowedWebhookUrl("https://10.0.0.5/webhook").allowed).toBe(false);
    expect(isAllowedWebhookUrl("https://172.16.0.5/webhook").allowed).toBe(false);
    expect(isAllowedWebhookUrl("https://192.168.1.1/webhook").allowed).toBe(false);
    expect(isAllowedWebhookUrl("https://169.254.169.254/webhook").allowed).toBe(false);
  });

  it("rejects a malformed URL", () => {
    expect(isAllowedWebhookUrl("not-a-url").allowed).toBe(false);
  });
});
