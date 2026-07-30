import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("node:dns/promises", () => {
  const lookup = vi.fn();
  return { lookup, default: { lookup } };
});

import { lookup } from "node:dns/promises";
import { isAllowedWebhookUrl, assertResolvesToPublicAddress } from "./ssrf-guard";

function mockLookupResult(addresses: { address: string; family: number }[]) {
  vi.mocked(lookup).mockResolvedValue(addresses as unknown as Awaited<ReturnType<typeof lookup>>);
}

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

describe("assertResolvesToPublicAddress", () => {
  beforeEach(() => {
    vi.mocked(lookup).mockReset();
  });

  it("rejects a hostname that resolves to a private IPv4 address (DNS-rebinding-style attack)", async () => {
    mockLookupResult([{ address: "10.0.0.5", family: 4 }]);

    await expect(
      assertResolvesToPublicAddress("https://internal.example.com/hook"),
    ).rejects.toThrow(/private\/internal address/i);
  });

  it("rejects when any resolved address is private, even if others are public", async () => {
    mockLookupResult([
      { address: "203.0.113.5", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]);

    await expect(assertResolvesToPublicAddress("https://mixed.example.com/hook")).rejects.toThrow(
      /private\/internal address/i,
    );
  });

  it("rejects a private IPv6 resolution", async () => {
    mockLookupResult([{ address: "fc00::1", family: 6 }]);

    await expect(assertResolvesToPublicAddress("https://v6.example.com/hook")).rejects.toThrow(
      /private\/internal address/i,
    );
  });

  it("allows a hostname that resolves only to public addresses", async () => {
    mockLookupResult([{ address: "203.0.113.5", family: 4 }]);

    await expect(
      assertResolvesToPublicAddress("https://public.example.com/hook"),
    ).resolves.toBeUndefined();
  });

  it("rejects before even resolving DNS if the URL itself fails the literal check", async () => {
    await expect(assertResolvesToPublicAddress("http://example.com/hook")).rejects.toThrow(
      /https/i,
    );
    expect(lookup).not.toHaveBeenCalled();
  });
});
