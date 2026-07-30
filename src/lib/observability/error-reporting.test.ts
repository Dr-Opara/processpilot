import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

import { captureException, isErrorReportingConfigured } from "./error-reporting";

describe("isErrorReportingConfigured", () => {
  const original = process.env.SENTRY_DSN;
  afterEach(() => {
    if (original === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = original;
  });

  it("is false without SENTRY_DSN", () => {
    delete process.env.SENTRY_DSN;
    expect(isErrorReportingConfigured()).toBe(false);
  });

  it("is true once SENTRY_DSN is set", () => {
    process.env.SENTRY_DSN = "https://example@sentry.io/1";
    expect(isErrorReportingConfigured()).toBe(true);
  });
});

describe("captureException", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs a structured, redacted event for a real Error", () => {
    const spy = vi.spyOn(console, "error");

    captureException(new Error("db write failed"), {
      organizationId: "org-1",
      apiKey: "should-not-appear",
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.message).toBe("db write failed");
    expect(parsed.organizationId).toBe("org-1");
    expect(parsed.apiKey).toBe("[redacted]");
  });

  it("never throws for a non-Error thrown value", () => {
    expect(() => captureException("a raw string")).not.toThrow();
  });
});
