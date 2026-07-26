import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz", () => ({
  getCurrentMembership: vi.fn(),
  requirePermission: vi.fn(),
}));
vi.mock("@/lib/db/tenant-context", () => ({
  withTenantContext: vi.fn(),
}));

import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { withTenantContext } from "@/lib/db/tenant-context";
import {
  createFakeSql,
  asTransactionSql,
  type FakeQueryHandler,
} from "@/lib/db/test-helpers/fake-sql";
import { makeMembership } from "@/lib/db/test-helpers/service-fixtures";
import {
  addCapaAction,
  closeCapaPlan,
  completeCapaAction,
  createCapaPlan,
  decideCapaPlanApproval,
  recordCapaEffectivenessCheck,
} from "./capa";
import { AppError } from "@/lib/errors";
import type { CapaActionRow, CapaPlanRow, ExceptionRow } from "@/lib/db/database.types";

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

function exception(): ExceptionRow {
  return { id: "exc-1", organization_id: "org-1", department_id: null } as ExceptionRow;
}

function capaPlan(overrides: Partial<CapaPlanRow> = {}): CapaPlanRow {
  return {
    id: "capa-1",
    organization_id: "org-1",
    department_id: null,
    exception_id: "exc-1",
    title: "Retrain staff",
    description: null,
    owner_member_id: "member-1",
    sponsor_member_id: null,
    completion_criteria: null,
    effectiveness_check_method: null,
    effectiveness_check_date: null,
    verification_owner_member_id: null,
    status: "draft",
    created_at: new Date().toISOString(),
    created_by_member_id: "member-1",
    closed_at: null,
    closed_by_member_id: null,
    ...overrides,
  };
}

function capaAction(overrides: Partial<CapaActionRow> = {}): CapaActionRow {
  return {
    id: "action-1",
    organization_id: "org-1",
    department_id: null,
    capa_plan_id: "capa-1",
    action_type: "corrective",
    title: "Update checklist",
    description: null,
    owner_member_id: "member-1",
    due_at: null,
    depends_on_action_id: null,
    requires_evidence: false,
    evidence_id: null,
    status: "open",
    created_at: new Date().toISOString(),
    created_by_member_id: "member-1",
    completed_at: null,
    completed_by_member_id: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(getCurrentMembership).mockReset();
  vi.mocked(requirePermission).mockReset();
});

describe("createCapaPlan", () => {
  it("creates a plan and moves the exception to action_plan_required", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    const membership = makeMembership({ permissions: ["capa.create"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    const fakeSql = wireTenantContext([
      {
        match: (t) => t.includes("select * from exceptions where id"),
        respond: () => [exception()],
      },
      { match: (t) => t.includes("insert into capa_plans"), respond: () => [capaPlan()] },
      catchAllAudit,
    ]);

    const plan = await createCapaPlan("exc-1", {
      title: "Retrain staff",
      ownerMemberId: "11111111-1111-4111-a111-111111111111",
    });

    expect(plan.title).toBe("Retrain staff");
    expect(fakeSql.calls.some((c) => c.text.includes("status = 'action_plan_required'"))).toBe(
      true,
    );
  });
});

describe("addCapaAction / completeCapaAction", () => {
  it("rejects completing an evidence-required action with no evidence provided", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    wireTenantContext([
      {
        match: (t) => t.includes("select * from capa_actions where id"),
        respond: () => [capaAction({ requires_evidence: true, evidence_id: null })],
      },
    ]);

    await expect(completeCapaAction("action-1")).rejects.toThrow("requires evidence");
  });

  it("completes an action once evidence is supplied", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    const membership = makeMembership({ permissions: ["capa.edit"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext([
      {
        match: (t) => t.includes("select * from capa_actions where id"),
        respond: () => [capaAction({ requires_evidence: true, evidence_id: null })],
      },
      {
        match: (t) => t.includes("update capa_actions set"),
        respond: () => [capaAction({ status: "completed", evidence_id: "ev-1" })],
      },
      catchAllAudit,
    ]);

    const updated = await completeCapaAction("action-1", "ev-1");
    expect(updated.status).toBe("completed");
  });

  it("adds an action to an existing plan", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    const membership = makeMembership({ permissions: ["capa.edit"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext([
      {
        match: (t) => t.includes("select * from capa_plans where id"),
        respond: () => [capaPlan()],
      },
      { match: (t) => t.includes("insert into capa_actions"), respond: () => [capaAction()] },
    ]);

    const action = await addCapaAction("capa-1", {
      actionType: "corrective",
      title: "Update checklist",
      ownerMemberId: "11111111-1111-4111-a111-111111111111",
      requiresEvidence: false,
    });
    expect(action.title).toBe("Update checklist");
  });
});

describe("decideCapaPlanApproval", () => {
  it("rejects a decision on a plan that isn't pending approval", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    wireTenantContext([
      {
        match: (t) => t.includes("select * from capa_plans where id"),
        respond: () => [capaPlan({ status: "draft" })],
      },
    ]);

    await expect(decideCapaPlanApproval("capa-1", "approved")).rejects.toThrow(AppError);
  });

  it("approves a pending plan", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    const membership = makeMembership({ permissions: ["capa.approve"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    const fakeSql = wireTenantContext([
      {
        match: (t) => t.includes("select * from capa_plans where id"),
        respond: () => [capaPlan({ status: "pending_approval" })],
      },
      { match: (t) => t.includes("insert into capa_approvals"), respond: () => [] },
      {
        match: (t) => t.includes("update capa_plans set status"),
        respond: () => [capaPlan({ status: "approved" })],
      },
      catchAllAudit,
    ]);

    const updated = await decideCapaPlanApproval("capa-1", "approved", "Looks good");
    expect(updated.status).toBe("approved");
    expect(fakeSql.calls.some((c) => c.text.includes("insert into capa_approvals"))).toBe(true);
  });
});

describe("recordCapaEffectivenessCheck / closeCapaPlan", () => {
  it("marks a plan ineffective when the check fails", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    const membership = makeMembership({ permissions: ["capa.verify"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    const fakeSql = wireTenantContext([
      {
        match: (t) => t.includes("select * from capa_plans where id"),
        respond: () => [capaPlan({ status: "pending_verification" })],
      },
      {
        match: (t) => t.includes("insert into capa_effectiveness_checks"),
        respond: () => [{ id: "check-1", outcome: "ineffective" }],
      },
      { match: (t) => t.includes("update capa_plans set status"), respond: () => [] },
      catchAllAudit,
    ]);

    await recordCapaEffectivenessCheck("capa-1", "ineffective", "Recurred within a week");
    expect(fakeSql.calls.some((c) => c.text.includes("update capa_plans set status"))).toBe(true);
  });

  it("refuses to close a plan that hasn't been verified effective", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    wireTenantContext([
      {
        match: (t) => t.includes("select * from capa_plans where id"),
        respond: () => [capaPlan({ status: "in_progress" })],
      },
    ]);

    await expect(closeCapaPlan("capa-1")).rejects.toThrow("effective");
  });

  it("closes a plan verified effective", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    const membership = makeMembership({ permissions: ["capa.close"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext([
      {
        match: (t) => t.includes("select * from capa_plans where id"),
        respond: () => [capaPlan({ status: "effective" })],
      },
      {
        match: (t) => t.includes("update capa_plans set status = 'closed'"),
        respond: () => [capaPlan({ status: "closed" })],
      },
      catchAllAudit,
    ]);

    const updated = await closeCapaPlan("capa-1");
    expect(updated.status).toBe("closed");
  });
});
