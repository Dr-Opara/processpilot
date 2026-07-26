import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client-admin", () => ({ getAdminSql: vi.fn() }));

import { getAdminSql } from "@/lib/db/client-admin";
import { getJobHandler } from "@/lib/jobs/registry";
import { createFakeSql, asSql, type FakeQueryHandler } from "@/lib/db/test-helpers/fake-sql";
import type { BackgroundJobRow } from "@/lib/db/database.types";

import "./training-handlers";

function job(overrides: Partial<BackgroundJobRow> = {}): BackgroundJobRow {
  return {
    id: "job-1",
    organization_id: "org-1",
    job_type: "training-assignment-overdue-check",
    payload: { assignmentId: "assignment-1" },
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

describe("training-assignment-overdue-check handler", () => {
  it("marks a past-due assignment overdue", async () => {
    const fakeSql = wireAdminSql([
      {
        match: (t) => t.includes("select * from training_assignments"),
        respond: () => [
          {
            id: "assignment-1",
            organization_id: "org-1",
            status: "assigned",
            due_at: new Date(Date.now() - 1000).toISOString(),
          },
        ],
      },
      {
        match: (t) => t.includes("update training_assignments set status = 'overdue'"),
        respond: () => [],
      },
    ]);

    await getJobHandler("training-assignment-overdue-check")!({ job: job() });

    expect(
      fakeSql.calls.some((c) =>
        c.text.includes("update training_assignments set status = 'overdue'"),
      ),
    ).toBe(true);
  });
});

describe("certification-expiry-check handler", () => {
  it("expires a past-due certification", async () => {
    const fakeSql = wireAdminSql([
      {
        match: (t) => t.includes("select * from certifications"),
        respond: () => [
          {
            id: "cert-1",
            organization_id: "org-1",
            status: "active",
            expires_at: new Date(Date.now() - 1000).toISOString(),
          },
        ],
      },
      {
        match: (t) => t.includes("update certifications set status = 'expired'"),
        respond: () => [],
      },
      { match: (t) => t.includes("insert into audit_events"), respond: () => [{ id: "audit-1" }] },
    ]);

    await getJobHandler("certification-expiry-check")!({
      job: job({ job_type: "certification-expiry-check", payload: { certificationId: "cert-1" } }),
    });

    expect(
      fakeSql.calls.some((c) => c.text.includes("update certifications set status = 'expired'")),
    ).toBe(true);
  });
});
