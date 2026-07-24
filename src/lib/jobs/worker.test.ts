import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { computeBackoffMs } = await import("./worker");

describe("computeBackoffMs", () => {
  it("doubles from a 30s base for successive attempts", () => {
    expect(computeBackoffMs(1)).toBe(30_000);
    expect(computeBackoffMs(2)).toBe(60_000);
    expect(computeBackoffMs(3)).toBe(120_000);
    expect(computeBackoffMs(4)).toBe(240_000);
  });

  it("caps at one hour for large attempt counts", () => {
    expect(computeBackoffMs(10)).toBe(60 * 60 * 1000);
    expect(computeBackoffMs(50)).toBe(60 * 60 * 1000);
  });

  it("treats non-positive attempts as the base delay", () => {
    expect(computeBackoffMs(0)).toBe(30_000);
    expect(computeBackoffMs(-1)).toBe(30_000);
  });
});
