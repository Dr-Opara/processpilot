import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({
  processDueJobs: vi.fn(async () => ({
    reclaimed: 0,
    claimed: 0,
    succeeded: 0,
    failed: 0,
    deadLettered: 0,
  })),
}));

vi.mock("@/lib/jobs/worker", () => ({
  processDueJobs: state.processDueJobs,
}));

function cronRequest(authorization?: string) {
  return new NextRequest("http://localhost/api/jobs/process", {
    headers: authorization ? { authorization } : {},
  });
}

describe("GET /api/jobs/process", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    state.processDueJobs.mockClear();
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalSecret;
  });

  // The first dynamic import() pulls in every registered job handler's
  // full module graph (workflow-engine.ts, forms.ts, evidence.ts, and
  // @supabase/supabase-js) — slower to cold-load than Vitest's default
  // 5s per-test timeout, especially under CI/parallel load.
  it("rejects the request when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import("./route");

    const response = await GET(cronRequest("Bearer anything"));

    expect(response.status).toBe(401);
    expect(state.processDueJobs).not.toHaveBeenCalled();
  }, 20_000);

  it("rejects a request with a missing or wrong Authorization header", async () => {
    process.env.CRON_SECRET = "test-secret";
    const { GET } = await import("./route");

    expect((await GET(cronRequest())).status).toBe(401);
    expect((await GET(cronRequest("Bearer wrong-secret"))).status).toBe(401);
    expect(state.processDueJobs).not.toHaveBeenCalled();
  }, 20_000);

  it("runs the worker tick and returns its result for a correctly authorized request", async () => {
    process.env.CRON_SECRET = "test-secret";
    const { GET } = await import("./route");

    const response = await GET(cronRequest("Bearer test-secret"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      reclaimed: 0,
      claimed: 0,
      succeeded: 0,
      failed: 0,
      deadLettered: 0,
    });
    expect(state.processDueJobs).toHaveBeenCalledTimes(1);
  });

  it("returns 500 without leaking the error when the worker tick throws", async () => {
    process.env.CRON_SECRET = "test-secret";
    state.processDueJobs.mockRejectedValueOnce(new Error("boom"));
    const { GET } = await import("./route");

    const response = await GET(cronRequest("Bearer test-secret"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Worker tick failed" });
  });
});
