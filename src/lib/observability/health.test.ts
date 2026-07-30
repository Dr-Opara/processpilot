import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/ai/availability", () => ({ isAiConfigured: () => false }));
vi.mock("@/lib/notifications/availability", () => ({ isEmailConfigured: () => false }));
vi.mock("@/lib/billing/availability", () => ({ isBillingConfigured: () => false }));
vi.mock("@/lib/crypto/secret-box", () => ({ isEncryptionConfigured: () => false }));
vi.mock("@/lib/integrations/providers/slack-provider", () => ({ isSlackConfigured: () => false }));
vi.mock("@/lib/observability/error-reporting", () => ({ isErrorReportingConfigured: () => false }));
vi.mock("@/lib/services/organization-deletion", () => ({
  isOrganizationDeletionEnabled: () => false,
}));

const adminState = vi.hoisted(() => ({
  sql: undefined as unknown as ReturnType<typeof import("@/lib/db/test-helpers/fake-sql").asSql>,
}));
vi.mock("@/lib/db/client-admin", () => ({ getAdminSql: () => adminState.sql }));

import { createFakeSql, asSql, type FakeQueryHandler } from "@/lib/db/test-helpers/fake-sql";
import { checkReadiness, getProviderConfigurationStatus, getQueueHealth } from "./health";

function wireAdminSql(handlers: FakeQueryHandler[]) {
  const fakeSql = createFakeSql(handlers);
  adminState.sql = asSql(fakeSql);
  return fakeSql;
}

describe("getProviderConfigurationStatus", () => {
  it("reports every optional provider as not_configured in this environment", () => {
    const statuses = getProviderConfigurationStatus();
    expect(statuses.every((s) => s.status === "not_configured")).toBe(true);
    expect(statuses.map((s) => s.name)).toContain("ai");
  });
});

describe("getQueueHealth", () => {
  it("reports pending/processing/dead-letter counts from background_jobs", async () => {
    wireAdminSql([
      {
        match: (t) => t.includes("status = 'pending' and scheduled_at"),
        respond: () => [{ count: "3", oldest: new Date(Date.now() - 5000).toISOString() }],
      },
      {
        match: (t) => t.includes("status = 'processing'"),
        respond: () => [{ count: "1" }],
      },
      {
        match: (t) => t.includes("dead_letter"),
        respond: () => [{ count: "2" }],
      },
    ]);

    const health = await getQueueHealth();

    expect(health.pendingCount).toBe(3);
    expect(health.processingCount).toBe(1);
    expect(health.deadLetterCountLast24h).toBe(2);
    expect(health.oldestPendingAgeSeconds).toBeGreaterThanOrEqual(0);
  });
});

describe("checkReadiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is unavailable when the database check fails", async () => {
    wireAdminSql([
      {
        match: () => true,
        respond: () => {
          throw new Error("connection refused");
        },
      },
    ]);

    const result = await checkReadiness();

    expect(result.status).toBe("unavailable");
    expect(result.database.status).toBe("unavailable");
    expect(result.queue).toBeNull();
  });

  it("is ok when the database and queue checks both succeed", async () => {
    wireAdminSql([
      { match: (t) => t.includes("select 1"), respond: () => [{ "?column?": 1 }] },
      {
        match: (t) => t.includes("from background_jobs") && t.includes("scheduled_at"),
        respond: () => [{ count: "0", oldest: null }],
      },
      { match: (t) => t.includes("status = 'processing'"), respond: () => [{ count: "0" }] },
      { match: (t) => t.includes("dead_letter"), respond: () => [{ count: "0" }] },
    ]);

    const result = await checkReadiness();

    expect(result.status).toBe("ok");
    expect(result.database.status).toBe("ok");
    expect(result.queue).not.toBeNull();
  });
});
