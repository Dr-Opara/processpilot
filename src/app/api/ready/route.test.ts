import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/observability/health", () => ({ checkReadiness: vi.fn() }));

import { checkReadiness } from "@/lib/observability/health";
import { GET } from "./route";

describe("GET /api/ready", () => {
  it("returns 200 when ready", async () => {
    vi.mocked(checkReadiness).mockResolvedValue({
      status: "ok",
      database: { name: "database", status: "ok" },
      queue: {
        pendingCount: 0,
        oldestPendingAgeSeconds: null,
        deadLetterCountLast24h: 0,
        processingCount: 0,
      },
      providers: [],
      organizationDeletionSweepEnabled: false,
    });

    const response = await GET();

    expect(response.status).toBe(200);
  });

  it("returns 503 when the database is unavailable", async () => {
    vi.mocked(checkReadiness).mockResolvedValue({
      status: "unavailable",
      database: { name: "database", status: "unavailable" },
      queue: null,
      providers: [],
      organizationDeletionSweepEnabled: false,
    });

    const response = await GET();

    expect(response.status).toBe(503);
  });

  it("never includes a stack trace or connection string in the response body", async () => {
    vi.mocked(checkReadiness).mockResolvedValue({
      status: "ok",
      database: { name: "database", status: "ok" },
      queue: {
        pendingCount: 0,
        oldestPendingAgeSeconds: null,
        deadLetterCountLast24h: 0,
        processingCount: 0,
      },
      providers: [],
      organizationDeletionSweepEnabled: false,
    });

    const response = await GET();
    const text = JSON.stringify(await response.json());

    expect(text).not.toMatch(/postgres:\/\/|sk_live|whsec_/);
  });
});
