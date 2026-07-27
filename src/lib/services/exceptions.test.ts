import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz", () => ({
  getCurrentMembership: vi.fn(),
  requirePermission: vi.fn(),
}));
vi.mock("@/lib/db/tenant-context", () => ({
  withTenantContext: vi.fn(),
}));
vi.mock("@/lib/services/notifications", () => ({
  createNotification: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/services/exception-recurrence", () => ({
  findRecurrenceMatches: vi.fn().mockResolvedValue(undefined),
}));

import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { withTenantContext } from "@/lib/db/tenant-context";
import {
  createFakeSql,
  asTransactionSql,
  asSql,
  type FakeQueryHandler,
} from "@/lib/db/test-helpers/fake-sql";
import { makeMembership } from "@/lib/db/test-helpers/service-fixtures";
import {
  calculatePriority,
  closeException,
  createException,
  createSystemException,
  reopenException,
  rejectException,
  startInvestigation,
  triageException,
} from "./exceptions";
import { AppError } from "@/lib/errors";
import type { ExceptionRow } from "@/lib/db/database.types";

function wireTenantContext(handlers: FakeQueryHandler[] = []) {
  const fakeSql = createFakeSql(handlers);
  vi.mocked(withTenantContext).mockImplementation(async (_ctx, fn) =>
    fn(asTransactionSql(fakeSql)),
  );
  return fakeSql;
}

const catchAllAudit: FakeQueryHandler = {
  match: (t) => t.includes("insert into audit_events"),
  respond: () => [{ id: "audit-1" }],
};

function exception(overrides: Partial<ExceptionRow> = {}): ExceptionRow {
  return {
    id: "exc-1",
    organization_id: "org-1",
    department_id: null,
    location_id: null,
    team_id: null,
    title: "Missed the deadline",
    description: null,
    exception_type: "task_failure",
    source: "manager_submission",
    severity: "moderate",
    likelihood: null,
    impact: null,
    priority: "moderate",
    priority_overridden: false,
    priority_override_reason: null,
    status: "reported",
    reporter_member_id: "member-1",
    owner_member_id: null,
    investigator_member_id: null,
    process_id: null,
    process_version_id: null,
    workflow_id: null,
    task_id: null,
    document_id: null,
    document_version_id: null,
    form_submission_id: null,
    evidence_id: null,
    approval_decision_id: null,
    control_reference: null,
    due_at: null,
    detected_at: null,
    occurred_at: null,
    containment_summary: null,
    root_cause_summary: null,
    remediation_summary: null,
    verification_summary: null,
    closure_reason: null,
    reopen_reason: null,
    tags: [],
    created_at: new Date().toISOString(),
    created_by_member_id: "member-1",
    updated_at: new Date().toISOString(),
    closed_at: null,
    closed_by_member_id: null,
    ...overrides,
  };
}

describe("calculatePriority", () => {
  it("scales with severity alone", () => {
    expect(calculatePriority({ severity: "low" })).toBe("low");
    expect(calculatePriority({ severity: "critical" })).toBe("critical");
  });

  it("escalates to critical when risk flags stack on top of high severity", () => {
    expect(
      calculatePriority({
        severity: "critical",
        likelihood: "high",
        impact: "high",
        regulatoryImpact: true,
      }),
    ).toBe("critical");
  });

  it("nudges up for regulatory impact, recurrence, SLA breach, and customer impact", () => {
    const base = calculatePriority({ severity: "moderate" });
    const boosted = calculatePriority({
      severity: "moderate",
      regulatoryImpact: true,
      recurrence: true,
      slaBreach: true,
      customerImpact: true,
    });
    expect(base).toBe("moderate");
    expect(boosted).toBe("critical");
  });
});

describe("createException", () => {
  beforeEach(() => {
    vi.mocked(getCurrentMembership).mockReset();
    vi.mocked(requirePermission).mockReset();
  });

  it("rejects a caller without exceptions.create", async () => {
    vi.mocked(requirePermission).mockRejectedValue(
      new AppError("forbidden", "Missing permission."),
    );
    await expect(
      createException({
        title: "Test",
        exceptionType: "process_deviation",
        source: "employee_submission",
        tags: [],
        severity: "moderate",
      } as never),
    ).rejects.toThrow(AppError);
  });

  it("creates an exception with a calculated priority and records history/audit", async () => {
    const membership = makeMembership({ permissions: ["exceptions.create"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    const fakeSql = wireTenantContext([
      {
        match: (t) => t.includes("insert into exceptions"),
        respond: () => [exception({ priority: "high" })],
      },
      catchAllAudit,
    ]);

    const created = await createException({
      title: "Deviation from checklist",
      exceptionType: "process_deviation",
      source: "employee_submission",
      severity: "high",
      tags: ["safety"],
      regulatoryImpact: false,
      recurrence: false,
      slaBreach: false,
      customerImpact: false,
    });

    expect(created.priority).toBe("high");
    expect(fakeSql.calls.some((c) => c.text.includes("insert into exception_history"))).toBe(true);
  });
});

describe("createSystemException", () => {
  it("is idempotent — a second call for the same task/source is a no-op that returns the existing row", async () => {
    const fakeSql = createFakeSql([
      {
        match: (t) => t.includes("select * from exceptions"),
        respond: () => [exception({ id: "existing-exc", source: "workflow_failure" })],
      },
    ]);

    const result = await createSystemException(asSql(fakeSql), {
      organizationId: "org-1",
      title: "Workflow failed",
      exceptionType: "task_failure",
      source: "workflow_failure",
      workflowId: "wf-1",
      idempotencyMatch: { workflowId: "wf-1" },
    });

    expect(result.id).toBe("existing-exc");
    expect(fakeSql.calls.some((c) => c.text.includes("insert into exceptions"))).toBe(false);
  });

  it("creates a new exception when no matching open one exists", async () => {
    const fakeSql = createFakeSql([
      { match: (t) => t.includes("select * from exceptions"), respond: () => [] },
      {
        match: (t) => t.includes("insert into exceptions"),
        respond: () => [exception({ source: "missed_sla", exception_type: "missed_sla" })],
      },
      catchAllAudit,
    ]);

    const result = await createSystemException(asSql(fakeSql), {
      organizationId: "org-1",
      title: "Missed SLA",
      exceptionType: "missed_sla",
      source: "missed_sla",
      taskId: "task-1",
      idempotencyMatch: { taskId: "task-1" },
    });

    expect(result.exception_type).toBe("missed_sla");
    expect(fakeSql.calls.some((c) => c.text.includes("insert into exceptions"))).toBe(true);
  });
});

describe("triageException", () => {
  beforeEach(() => {
    vi.mocked(getCurrentMembership).mockReset();
    vi.mocked(requirePermission).mockReset();
  });

  it("requires a reason to manually override the calculated priority", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    wireTenantContext([
      {
        match: (t) => t.includes("select * from exceptions where id"),
        respond: () => [exception()],
      },
    ]);

    await expect(triageException("exc-1", { priorityOverride: "critical" })).rejects.toThrow(
      "reason is required",
    );
  });

  it("recalculates priority from severity/likelihood/impact and moves 'reported' to 'triaged'", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    const membership = makeMembership({ permissions: ["exceptions.triage"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    const fakeSql = wireTenantContext([
      {
        match: (t) => t.includes("select * from exceptions where id"),
        respond: () => [exception({ status: "reported" })],
      },
      {
        match: (t) => t.includes("update exceptions set"),
        respond: () => [exception({ status: "triaged", severity: "high" })],
      },
      catchAllAudit,
    ]);

    const updated = await triageException("exc-1", {
      severity: "high",
      ownerMemberId: "22222222-2222-4222-a222-222222222222",
    });

    expect(updated.status).toBe("triaged");
    expect(fakeSql.calls.some((c) => c.text.includes("insert into exception_history"))).toBe(true);
  });
});

describe("startInvestigation", () => {
  it("sets status to under_investigation and logs it", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    const membership = makeMembership({ permissions: ["exceptions.investigate"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    const fakeSql = wireTenantContext([
      {
        match: (t) => t.includes("select * from exceptions where id"),
        respond: () => [exception()],
      },
      {
        match: (t) => t.includes("update exceptions set status = 'under_investigation'"),
        respond: () => [exception({ status: "under_investigation" })],
      },
      catchAllAudit,
    ]);

    const updated = await startInvestigation("exc-1");
    expect(updated.status).toBe("under_investigation");
    expect(fakeSql.calls.some((c) => c.text.includes("insert into exception_history"))).toBe(true);
  });
});

describe("closeException", () => {
  beforeEach(() => {
    vi.mocked(getCurrentMembership).mockReset();
    vi.mocked(requirePermission).mockReset();
  });

  it("rejects closure without a documented root cause and no override", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    const membership = makeMembership({ permissions: ["exceptions.close"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext([
      {
        match: (t) => t.includes("select * from exceptions where id"),
        respond: () => [exception()],
      },
      { match: (t) => t.includes("from root_cause_analyses"), respond: () => [] },
    ]);

    await expect(closeException("exc-1", { closureReason: "Fixed" })).rejects.toThrow("root cause");
  });

  it("closes when a root cause is documented", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    const membership = makeMembership({ permissions: ["exceptions.close"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    const fakeSql = wireTenantContext([
      {
        match: (t) => t.includes("select * from exceptions where id"),
        respond: () => [exception()],
      },
      { match: (t) => t.includes("from root_cause_analyses"), respond: () => [{ id: "rca-1" }] },
      {
        match: (t) => t.includes("update exceptions set"),
        respond: () => [exception({ status: "closed" })],
      },
      catchAllAudit,
    ]);

    const updated = await closeException("exc-1", { closureReason: "Fixed the checklist" });
    expect(updated.status).toBe("closed");
    expect(fakeSql.calls.some((c) => c.text.includes("status = 'closed'"))).toBe(true);
  });

  it("allows closure without a root cause when explicitly overridden with a reason", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    const membership = makeMembership({ permissions: ["exceptions.close"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    const fakeSql = wireTenantContext([
      {
        match: (t) => t.includes("select * from exceptions where id"),
        respond: () => [exception()],
      },
      {
        match: (t) => t.includes("update exceptions set"),
        respond: () => [exception({ status: "closed" })],
      },
      catchAllAudit,
    ]);

    const updated = await closeException("exc-1", {
      closureReason: "Accepted risk",
      allowClosureWithoutRootCause: true,
      allowClosureWithoutRootCauseReason: "Low-severity, one-off",
    });
    expect(updated.status).toBe("closed");
    expect(fakeSql.calls.some((c) => c.text.includes("from root_cause_analyses"))).toBe(false);
  });
});

describe("rejectException / reopenException", () => {
  beforeEach(() => {
    vi.mocked(getCurrentMembership).mockReset();
    vi.mocked(requirePermission).mockReset();
  });

  it("requires a reason to reject", async () => {
    await expect(rejectException("exc-1", "  ")).rejects.toThrow("reason is required");
  });

  it("only allows reopening a closed or rejected exception", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    wireTenantContext([
      {
        match: (t) => t.includes("select * from exceptions where id"),
        respond: () => [exception({ status: "under_investigation" })],
      },
    ]);

    await expect(reopenException("exc-1", "New evidence surfaced")).rejects.toThrow(
      "closed or rejected",
    );
  });

  it("reopens a closed exception with a reason", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    const membership = makeMembership({ permissions: ["exceptions.close"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    const fakeSql = wireTenantContext([
      {
        match: (t) => t.includes("select * from exceptions where id"),
        respond: () => [exception({ status: "closed" })],
      },
      {
        match: (t) => t.includes("update exceptions set"),
        respond: () => [exception({ status: "reopened" })],
      },
      catchAllAudit,
    ]);

    const updated = await reopenException("exc-1", "New evidence surfaced");
    expect(updated.status).toBe("reopened");
    expect(fakeSql.calls.some((c) => c.text.includes("status = 'reopened'"))).toBe(true);
  });
});
