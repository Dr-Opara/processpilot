import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz", () => ({
  getCurrentMembership: vi.fn(),
  requirePermission: vi.fn(),
}));
vi.mock("@/lib/db/tenant-context", () => ({
  withTenantContext: vi.fn(),
}));
vi.mock("@/lib/jobs/enqueue", () => ({ enqueueJob: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/services/certifications", () => ({
  issueCertification: vi.fn().mockResolvedValue({ id: "cert-1" }),
}));

import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { withTenantContext } from "@/lib/db/tenant-context";
import { enqueueJob } from "@/lib/jobs/enqueue";
import { issueCertification } from "@/lib/services/certifications";
import {
  createFakeSql,
  asTransactionSql,
  asSql,
  type FakeQueryHandler,
} from "@/lib/db/test-helpers/fake-sql";
import { makeMembership } from "@/lib/db/test-helpers/service-fixtures";
import {
  assignTraining,
  completeTrainingAssignment,
  markAssignmentOverdue,
  resolveTrainingAssignees,
  retakeTrainingAssignment,
  startTrainingAssignment,
  waiveTrainingAssignment,
} from "./training-assignments";
import { AppError } from "@/lib/errors";
import type { TrainingAssignmentRow, TrainingCourseVersionRow } from "@/lib/db/database.types";

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

function assignment(overrides: Partial<TrainingAssignmentRow> = {}): TrainingAssignmentRow {
  return {
    id: "assignment-1",
    organization_id: "org-1",
    department_id: null,
    course_version_id: "version-1",
    assignee_member_id: "member-1",
    assigned_via: "individual",
    due_at: null,
    status: "assigned",
    attempt_count: 0,
    started_at: null,
    completed_at: null,
    score_percent: null,
    passed: null,
    answers: {},
    waived_reason: null,
    waived_by: null,
    created_at: new Date().toISOString(),
    created_by: "profile-1",
    ...overrides,
  };
}

function courseVersion(
  overrides: Partial<TrainingCourseVersionRow> = {},
): TrainingCourseVersionRow {
  return {
    id: "version-1",
    organization_id: "org-1",
    course_id: "course-1",
    department_id: null,
    version_number: 1,
    title: "v1",
    content: "content",
    has_assessment: false,
    assessment_questions: [],
    passing_score_percent: null,
    status: "published",
    published_by: "member-1",
    published_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    created_by: "profile-1",
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(getCurrentMembership).mockReset();
  vi.mocked(requirePermission).mockReset();
  vi.mocked(enqueueJob).mockClear();
  vi.mocked(issueCertification).mockClear();
});

describe("resolveTrainingAssignees", () => {
  it("resolves 'individual' directly to the target id", async () => {
    const sql = asSql(createFakeSql([]));
    expect(await resolveTrainingAssignees(sql, "org-1", "individual", "member-9")).toEqual([
      "member-9",
    ]);
  });

  it("resolves 'role' to every active member holding that role", async () => {
    const sql = asSql(
      createFakeSql([
        {
          match: (t) => t.includes("from member_role_assignments"),
          respond: () => [{ organization_member_id: "m1" }, { organization_member_id: "m2" }],
        },
      ]),
    );
    expect(await resolveTrainingAssignees(sql, "org-1", "role", "role-1")).toEqual(["m1", "m2"]);
  });

  it("resolves 'department' to every active member of that department", async () => {
    const sql = asSql(
      createFakeSql([
        {
          match: (t) => t.includes("from organization_members where department_id"),
          respond: () => [{ id: "m1" }],
        },
      ]),
    );
    expect(await resolveTrainingAssignees(sql, "org-1", "department", "dept-1")).toEqual(["m1"]);
  });

  it("resolves 'team' to every active team member", async () => {
    const sql = asSql(
      createFakeSql([
        {
          match: (t) => t.includes("from team_members"),
          respond: () => [{ organization_member_id: "m3" }],
        },
      ]),
    );
    expect(await resolveTrainingAssignees(sql, "org-1", "team", "team-1")).toEqual(["m3"]);
  });
});

describe("assignTraining", () => {
  it("rejects assigning an unpublished course version", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    wireTenantContext([
      {
        match: (t) => t.includes("select * from training_course_versions where id"),
        respond: () => [courseVersion({ status: "draft" })],
      },
    ]);

    await expect(
      assignTraining({
        courseVersionId: "11111111-1111-4111-a111-111111111111",
        assignedVia: "individual",
        targetId: "22222222-2222-4222-a222-222222222222",
      }),
    ).rejects.toThrow("Only a published");
  });

  it("throws when the rule resolves to no eligible members", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    const membership = makeMembership({ permissions: ["training.manage"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext([
      {
        match: (t) => t.includes("select * from training_course_versions where id"),
        respond: () => [courseVersion()],
      },
      {
        match: (t) => t.includes("from organization_members where department_id"),
        respond: () => [],
      },
    ]);

    await expect(
      assignTraining({
        courseVersionId: "11111111-1111-4111-a111-111111111111",
        assignedVia: "department",
        targetId: "33333333-3333-4333-a333-333333333333",
      }),
    ).rejects.toThrow(AppError);
  });

  it("fans out one assignment per resolved member and schedules an overdue check when a due date is set", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    const membership = makeMembership({ permissions: ["training.manage"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext([
      {
        match: (t) => t.includes("select * from training_course_versions where id"),
        respond: () => [courseVersion()],
      },
      {
        match: (t) => t.includes("from member_role_assignments"),
        respond: () => [{ organization_member_id: "m1" }, { organization_member_id: "m2" }],
      },
      {
        match: (t) => t.includes("insert into training_assignments"),
        respond: (values) => [
          assignment({ id: `a-${values[2]}`, assignee_member_id: values[2] as string }),
        ],
      },
      catchAllAudit,
    ]);

    const dueAt = new Date(Date.now() + 86_400_000).toISOString();
    const created = await assignTraining({
      courseVersionId: "11111111-1111-4111-a111-111111111111",
      assignedVia: "role",
      targetId: "44444444-4444-4444-a444-444444444444",
      dueAt,
    });

    expect(created).toHaveLength(2);
    expect(enqueueJob).toHaveBeenCalledTimes(2);
  });
});

describe("startTrainingAssignment", () => {
  it("rejects a caller who isn't the assignee", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(
      makeMembership({ member: { id: "someone-else" } }),
    );
    wireTenantContext([
      {
        match: (t) => t.includes("select * from training_assignments where id"),
        respond: () => [assignment({ assignee_member_id: "member-1" })],
      },
    ]);

    await expect(startTrainingAssignment("assignment-1")).rejects.toThrow("not the assignee");
  });

  it("starts an assigned/overdue assignment", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(
      makeMembership({ member: { id: "member-1" } }),
    );
    const membership = makeMembership({
      member: { id: "member-1" },
      permissions: ["training.complete"],
    });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext([
      {
        match: (t) => t.includes("select * from training_assignments where id"),
        respond: () => [assignment({ assignee_member_id: "member-1" })],
      },
      {
        match: (t) => t.includes("update training_assignments set status = 'in_progress'"),
        respond: () => [assignment({ status: "in_progress" })],
      },
    ]);

    const updated = await startTrainingAssignment("assignment-1");
    expect(updated.status).toBe("in_progress");
  });
});

describe("completeTrainingAssignment", () => {
  it("issues a certification on a pass (no assessment)", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(
      makeMembership({ member: { id: "member-1" } }),
    );
    const membership = makeMembership({
      member: { id: "member-1" },
      permissions: ["training.complete"],
    });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext([
      {
        match: (t) => t.includes("select * from training_assignments where id"),
        respond: () => [assignment({ assignee_member_id: "member-1", status: "in_progress" })],
      },
      {
        match: (t) => t.includes("select * from training_course_versions where id"),
        respond: () => [courseVersion({ has_assessment: false })],
      },
      {
        match: (t) => t.includes("update training_assignments set"),
        respond: () => [assignment({ status: "completed", passed: true, score_percent: 100 })],
      },
      catchAllAudit,
    ]);

    const updated = await completeTrainingAssignment("assignment-1");
    expect(updated.status).toBe("completed");
    expect(issueCertification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ courseId: "course-1" }),
    );
  });

  it("does not issue a certification on a failed assessment attempt", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(
      makeMembership({ member: { id: "member-1" } }),
    );
    const membership = makeMembership({
      member: { id: "member-1" },
      permissions: ["training.complete"],
    });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext([
      {
        match: (t) => t.includes("select * from training_assignments where id"),
        respond: () => [assignment({ assignee_member_id: "member-1", status: "in_progress" })],
      },
      {
        match: (t) => t.includes("select * from training_course_versions where id"),
        respond: () => [
          courseVersion({
            has_assessment: true,
            passing_score_percent: 80,
            assessment_questions: [
              {
                id: "q1",
                prompt: "?",
                options: [
                  { key: "a", label: "A" },
                  { key: "b", label: "B" },
                ],
                correctOptionKey: "a",
              },
            ],
          }),
        ],
      },
      {
        match: (t) => t.includes("update training_assignments set"),
        respond: () => [assignment({ status: "assigned", passed: false, score_percent: 0 })],
      },
    ]);

    const updated = await completeTrainingAssignment("assignment-1", { answers: { q1: "b" } });
    expect(updated.passed).toBe(false);
    expect(issueCertification).not.toHaveBeenCalled();
  });
});

describe("retakeTrainingAssignment", () => {
  it("rejects retaking an already-passed assignment", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(
      makeMembership({ member: { id: "member-1" } }),
    );
    wireTenantContext([
      {
        match: (t) => t.includes("select * from training_assignments where id"),
        respond: () => [assignment({ assignee_member_id: "member-1", passed: true })],
      },
    ]);

    await expect(retakeTrainingAssignment("assignment-1")).rejects.toThrow("already been passed");
  });
});

describe("waiveTrainingAssignment", () => {
  it("requires a reason", async () => {
    await expect(waiveTrainingAssignment("assignment-1", "  ")).rejects.toThrow(
      "reason is required",
    );
  });
});

describe("markAssignmentOverdue (background job)", () => {
  it("is a no-op for an assignment already completed", async () => {
    const fakeSql = createFakeSql([
      {
        match: (t) => t.includes("select * from training_assignments"),
        respond: () => [assignment({ status: "completed" })],
      },
    ]);
    await markAssignmentOverdue(asTransactionSql(fakeSql), "assignment-1", "org-1");
    expect(fakeSql.calls.some((c) => c.text.includes("status = 'overdue'"))).toBe(false);
  });

  it("marks a past-due open assignment overdue", async () => {
    const fakeSql = createFakeSql([
      {
        match: (t) => t.includes("select * from training_assignments"),
        respond: () => [
          assignment({ status: "assigned", due_at: new Date(Date.now() - 1000).toISOString() }),
        ],
      },
      {
        match: (t) => t.includes("update training_assignments set status = 'overdue'"),
        respond: () => [],
      },
    ]);
    await markAssignmentOverdue(asTransactionSql(fakeSql), "assignment-1", "org-1");
    expect(
      fakeSql.calls.some((c) =>
        c.text.includes("update training_assignments set status = 'overdue'"),
      ),
    ).toBe(true);
  });
});
