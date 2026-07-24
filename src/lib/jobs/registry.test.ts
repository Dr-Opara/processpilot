import { describe, it, expect, beforeEach, vi } from "vitest";

describe("job handler registry", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns undefined for an unregistered job type", async () => {
    const { getJobHandler } = await import("./registry");
    expect(getJobHandler("does-not-exist")).toBeUndefined();
  });

  it("returns the registered handler for its job type", async () => {
    const { registerJobHandler, getJobHandler } = await import("./registry");
    const handler = vi.fn(async () => {});

    registerJobHandler("test-job", handler);

    expect(getJobHandler("test-job")).toBe(handler);
  });

  it("throws when the same job type is registered twice", async () => {
    const { registerJobHandler } = await import("./registry");

    registerJobHandler("dup-job", async () => {});

    expect(() => registerJobHandler("dup-job", async () => {})).toThrow(/already registered/);
  });
});
