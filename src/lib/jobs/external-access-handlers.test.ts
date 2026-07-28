import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client-admin", () => ({ getAdminSql: vi.fn() }));

import { getAdminSql } from "@/lib/db/client-admin";
import { getJobHandler } from "@/lib/jobs/registry";
import { createFakeSql, asSql, type FakeQueryHandler } from "@/lib/db/test-helpers/fake-sql";
import type { BackgroundJobRow } from "@/lib/db/database.types";

import "./external-access-handlers";

function job(overrides: Partial<BackgroundJobRow> = {}): BackgroundJobRow {
  return {
    id: "job-1",
    organization_id: "org-1",
    job_type: "external-access-expiration-check",
    payload: { grantId: "grant-1" },
    idempotency_key: "key-1",
    priority: 0,
    status: "processing",
    attempts: 1,
    max_attempts: 5,
    scheduled_at: new Date().toISOString(),
    last_error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: null,
    ...overrides,
  } as BackgroundJobRow;
}

function wireAdminSql(handlers: FakeQueryHandler[]) {
  const fakeSql = createFakeSql(handlers);
  vi.mocked(getAdminSql).mockReturnValue(asSql(fakeSql));
  return fakeSql;
}

describe("external-access-expiration-check handler", () => {
  it("is a no-op for a grant not yet past its expiry", async () => {
    const fakeSql = wireAdminSql([
      {
        match: (t) => t.includes("select * from external_access_grants"),
        respond: () => [
          {
            id: "grant-1",
            organization_id: "org-1",
            status: "active",
            member_id: "member-1",
            expires_at: new Date(Date.now() + 86_400_000).toISOString(),
          },
        ],
      },
    ]);

    await getJobHandler("external-access-expiration-check")!({ job: job() });

    expect(fakeSql.calls.some((c) => c.text.includes("update external_access_grants"))).toBe(false);
  });

  it("expires a grant past its expiry", async () => {
    const fakeSql = wireAdminSql([
      {
        match: (t) => t.includes("select * from external_access_grants"),
        respond: () => [
          {
            id: "grant-1",
            organization_id: "org-1",
            status: "active",
            member_id: "member-1",
            expires_at: new Date(Date.now() - 86_400_000).toISOString(),
          },
        ],
      },
      {
        match: (t) => t.includes("update external_access_grants set status = 'expired'"),
        respond: () => [],
      },
      {
        match: (t) => t.includes("update organization_members set status = 'suspended'"),
        respond: () => [],
      },
      { match: (t) => t.includes("insert into audit_events"), respond: () => [{ id: "audit-1" }] },
    ]);

    await getJobHandler("external-access-expiration-check")!({ job: job() });

    expect(
      fakeSql.calls.some((c) =>
        c.text.includes("update external_access_grants set status = 'expired'"),
      ),
    ).toBe(true);
  });
});
