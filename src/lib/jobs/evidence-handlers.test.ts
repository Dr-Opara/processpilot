import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client-admin", () => ({ getAdminSql: vi.fn() }));

import { getAdminSql } from "@/lib/db/client-admin";
import { getJobHandler } from "@/lib/jobs/registry";
import { createFakeSql, asSql, type FakeQueryHandler } from "@/lib/db/test-helpers/fake-sql";
import type { BackgroundJobRow } from "@/lib/db/database.types";

import "./evidence-handlers";

function job(overrides: Partial<BackgroundJobRow> = {}): BackgroundJobRow {
  return {
    id: "job-1",
    organization_id: "org-1",
    job_type: "evidence-expiration-check",
    payload: { evidenceId: "ev-1" },
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

describe("evidence-expiration-check handler", () => {
  it("is a no-op when the evidence is already terminal (rejected/replaced)", async () => {
    const fakeSql = wireAdminSql([
      {
        match: (t) => t.includes("select * from evidence where id"),
        respond: () => [{ id: "ev-1", organization_id: "org-1", status: "rejected" }],
      },
    ]);

    await getJobHandler("evidence-expiration-check")!({ job: job() });

    expect(
      fakeSql.calls.some((c) => c.text.includes("update evidence set status = 'expired'")),
    ).toBe(false);
  });

  it("expires accepted evidence and logs the chain-of-custody event", async () => {
    const fakeSql = wireAdminSql([
      {
        match: (t) => t.includes("select * from evidence where id"),
        respond: () => [{ id: "ev-1", organization_id: "org-1", status: "accepted" }],
      },
      {
        match: (t) => t.includes("update evidence set status = 'expired'"),
        respond: () => [{ id: "ev-1", organization_id: "org-1", status: "expired" }],
      },
      { match: (t) => t.includes("insert into evidence_events"), respond: () => [] },
      { match: (t) => t.includes("insert into audit_events"), respond: () => [{ id: "audit-1" }] },
    ]);

    await getJobHandler("evidence-expiration-check")!({ job: job() });

    expect(
      fakeSql.calls.some((c) => c.text.includes("update evidence set status = 'expired'")),
    ).toBe(true);
    expect(fakeSql.calls.some((c) => c.text.includes("insert into evidence_events"))).toBe(true);
  });

  it("re-running after the evidence already expired does nothing twice (idempotent retry)", async () => {
    wireAdminSql([
      {
        match: (t) => t.includes("select * from evidence where id"),
        respond: () => [{ id: "ev-1", organization_id: "org-1", status: "accepted" }],
      },
      {
        match: (t) => t.includes("update evidence set status = 'expired'"),
        respond: () => [{ id: "ev-1", organization_id: "org-1", status: "expired" }],
      },
      { match: (t) => t.includes("insert into evidence_events"), respond: () => [] },
      { match: (t) => t.includes("insert into audit_events"), respond: () => [{ id: "audit-1" }] },
    ]);
    await getJobHandler("evidence-expiration-check")!({ job: job() });

    const retryFakeSql = wireAdminSql([
      {
        match: (t) => t.includes("select * from evidence where id"),
        respond: () => [{ id: "ev-1", organization_id: "org-1", status: "expired" }],
      },
    ]);
    await getJobHandler("evidence-expiration-check")!({ job: job() });

    expect(
      retryFakeSql.calls.some((c) => c.text.includes("update evidence set status = 'expired'")),
    ).toBe(false);
  });
});
