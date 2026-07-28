import { describe, it, expect, vi, afterEach } from "vitest";
import { createHmac } from "node:crypto";

vi.mock("server-only", () => ({}));

import { isSlackSignatureConfigured, verifySlackSignature } from "./slack-signature";

const ORIGINAL = process.env.SLACK_SIGNING_SECRET;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.SLACK_SIGNING_SECRET;
  else process.env.SLACK_SIGNING_SECRET = ORIGINAL;
});

function sign(secret: string, timestamp: string, body: string): string {
  return `v0=${createHmac("sha256", secret).update(`v0:${timestamp}:${body}`).digest("hex")}`;
}

describe("isSlackSignatureConfigured", () => {
  it("is false when unset", () => {
    delete process.env.SLACK_SIGNING_SECRET;
    expect(isSlackSignatureConfigured()).toBe(false);
  });

  it("is true for a real-looking value", () => {
    process.env.SLACK_SIGNING_SECRET = "abc123realvalue";
    expect(isSlackSignatureConfigured()).toBe(true);
  });
});

describe("verifySlackSignature", () => {
  it("accepts a validly-signed, fresh request", () => {
    process.env.SLACK_SIGNING_SECRET = "shhh";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = '{"type":"event_callback"}';
    expect(verifySlackSignature(body, timestamp, sign("shhh", timestamp, body))).toBe(true);
  });

  it("rejects a signature computed with the wrong secret", () => {
    process.env.SLACK_SIGNING_SECRET = "shhh";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = '{"type":"event_callback"}';
    expect(verifySlackSignature(body, timestamp, sign("wrong-secret", timestamp, body))).toBe(
      false,
    );
  });

  it("rejects an old (replayed) timestamp", () => {
    process.env.SLACK_SIGNING_SECRET = "shhh";
    const timestamp = String(Math.floor(Date.now() / 1000) - 600);
    const body = '{"type":"event_callback"}';
    expect(verifySlackSignature(body, timestamp, sign("shhh", timestamp, body))).toBe(false);
  });

  it("rejects when unconfigured", () => {
    delete process.env.SLACK_SIGNING_SECRET;
    expect(verifySlackSignature("{}", "123", "v0=abc")).toBe(false);
  });
});
