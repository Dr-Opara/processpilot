import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

import { logEvent, redact, generateCorrelationId } from "./logger";

describe("redact", () => {
  it("redacts keys that look like secrets, recursively", () => {
    const result = redact({
      organizationId: "org-1",
      apiKey: "pp_live_abc123",
      nested: { token: "raw-token-value", safe: "keep-me" },
    }) as Record<string, unknown>;

    expect(result.organizationId).toBe("org-1");
    expect(result.apiKey).toBe("[redacted]");
    expect((result.nested as Record<string, unknown>).token).toBe("[redacted]");
    expect((result.nested as Record<string, unknown>).safe).toBe("keep-me");
  });

  it("handles arrays and circular references without throwing", () => {
    const circular: Record<string, unknown> = { name: "x" };
    circular.self = circular;

    expect(() => redact([circular, { password: "hunter2" }])).not.toThrow();
  });
});

describe("logEvent", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits a single JSON line with level/message/timestamp", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});

    logEvent("info", "something happened", { organizationId: "org-1" });

    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.level).toBe("info");
    expect(parsed.message).toBe("something happened");
    expect(parsed.organizationId).toBe("org-1");
    expect(typeof parsed.timestamp).toBe("string");
  });

  it("routes error level to console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    logEvent("error", "boom");

    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("generateCorrelationId", () => {
  it("produces a unique id each call", () => {
    expect(generateCorrelationId()).not.toBe(generateCorrelationId());
  });
});
