import { describe, it, expect, vi, afterEach } from "vitest";
import { createHmac } from "node:crypto";

vi.mock("server-only", () => ({}));

import { createOAuthState, verifyOAuthState } from "./oauth-state";

const ORIGINAL_KEY = process.env.INTEGRATION_ENCRYPTION_KEY;
const TEST_KEY = Buffer.alloc(32, 3).toString("base64");

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEY;
  else process.env.INTEGRATION_ENCRYPTION_KEY = ORIGINAL_KEY;
});

describe("createOAuthState / verifyOAuthState", () => {
  it("round-trips and returns the organization id for a valid state", () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = TEST_KEY;
    const state = createOAuthState("org-1", "slack");
    expect(verifyOAuthState(state, "slack")).toEqual({
      organizationId: "org-1",
      provider: "slack",
    });
  });

  it("rejects a state issued for a different provider", () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = TEST_KEY;
    const state = createOAuthState("org-1", "slack");
    expect(verifyOAuthState(state, "jira")).toBeNull();
  });

  it("rejects a tampered state", () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = TEST_KEY;
    const state = createOAuthState("org-1", "slack");
    const tampered = state.slice(0, -2) + "aa";
    expect(verifyOAuthState(tampered, "slack")).toBeNull();
  });

  it("rejects a malformed state", () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = TEST_KEY;
    expect(verifyOAuthState("not-a-real-state", "slack")).toBeNull();
  });

  it("rejects an expired state", () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = TEST_KEY;
    const oldTimestamp = Date.now() - 11 * 60_000;
    const payload = `org-1.slack.${oldTimestamp}.aaaaaaaaaaaaaaaa`;
    const signature = createHmac("sha256", Buffer.from(TEST_KEY, "base64"))
      .update(payload)
      .digest("hex");
    const state = Buffer.from(`${payload}.${signature}`).toString("base64url");
    expect(verifyOAuthState(state, "slack")).toBeNull();
  });
});
