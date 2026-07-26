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
  createDraftCourseVersion,
  createTrainingCourse,
  publishCourseVersion,
  trainingCourseVersionInputSchema,
} from "./training-courses";
import { AppError } from "@/lib/errors";
import type { TrainingCourseRow, TrainingCourseVersionRow } from "@/lib/db/database.types";

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

function course(overrides: Partial<TrainingCourseRow> = {}): TrainingCourseRow {
  return {
    id: "course-1",
    organization_id: "org-1",
    department_id: null,
    title: "Forklift safety",
    description: null,
    category: null,
    status: "draft",
    current_version_id: null,
    owner_member_id: null,
    created_at: new Date().toISOString(),
    created_by: "profile-1",
    updated_at: new Date().toISOString(),
    archived_at: null,
    ...overrides,
  };
}

function version(overrides: Partial<TrainingCourseVersionRow> = {}): TrainingCourseVersionRow {
  return {
    id: "version-1",
    organization_id: "org-1",
    course_id: "course-1",
    department_id: null,
    version_number: 1,
    title: "Forklift safety v1",
    content: "Read the manual.",
    has_assessment: false,
    assessment_questions: [],
    passing_score_percent: null,
    status: "draft",
    published_by: null,
    published_at: null,
    created_at: new Date().toISOString(),
    created_by: "profile-1",
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(getCurrentMembership).mockReset();
  vi.mocked(requirePermission).mockReset();
});

describe("trainingCourseVersionInputSchema", () => {
  it("requires at least one question and a passing score when hasAssessment is true", () => {
    expect(() =>
      trainingCourseVersionInputSchema.parse({
        title: "t",
        content: "c",
        hasAssessment: true,
        assessmentQuestions: [],
      }),
    ).toThrow();
  });

  it("requires each question's correctOptionKey to match one of its own options", () => {
    expect(() =>
      trainingCourseVersionInputSchema.parse({
        title: "t",
        content: "c",
        hasAssessment: true,
        passingScorePercent: 80,
        assessmentQuestions: [
          { id: "q1", prompt: "?", options: [{ key: "a", label: "A" }], correctOptionKey: "z" },
        ],
      }),
    ).toThrow();
  });

  it("accepts a well-formed assessment", () => {
    const parsed = trainingCourseVersionInputSchema.parse({
      title: "t",
      content: "c",
      hasAssessment: true,
      passingScorePercent: 80,
      assessmentQuestions: [
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
    });
    expect(parsed.hasAssessment).toBe(true);
  });
});

describe("createTrainingCourse", () => {
  it("creates a course and records an audit event", async () => {
    const membership = makeMembership({ permissions: ["training.manage"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    const fakeSql = wireTenantContext([
      { match: (t) => t.includes("insert into training_courses"), respond: () => [course()] },
      catchAllAudit,
    ]);

    const created = await createTrainingCourse({ title: "Forklift safety" });

    expect(created.title).toBe("Forklift safety");
    expect(fakeSql.calls.some((c) => c.text.includes("insert into audit_events"))).toBe(true);
  });
});

describe("createDraftCourseVersion", () => {
  it("rejects when a draft version already exists", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    const membership = makeMembership({ permissions: ["training.manage"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext([
      {
        match: (t) => t.includes("select * from training_courses where id"),
        respond: () => [course()],
      },
      {
        match: (t) => t.includes("select id from training_course_versions"),
        respond: () => [{ id: "existing-draft" }],
      },
    ]);

    await expect(
      createDraftCourseVersion("course-1", {
        title: "v2",
        content: "x",
        hasAssessment: false,
        assessmentQuestions: [],
      }),
    ).rejects.toThrow(AppError);
  });
});

describe("publishCourseVersion", () => {
  it("rejects publishing a non-draft version", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    wireTenantContext([
      {
        match: (t) => t.includes("select * from training_course_versions where id"),
        respond: () => [version({ status: "published" })],
      },
    ]);

    await expect(publishCourseVersion("version-1")).rejects.toThrow("Only a draft version");
  });

  it("supersedes the prior published version and repoints the course", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    const membership = makeMembership({ permissions: ["training.manage"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    const fakeSql = wireTenantContext([
      {
        match: (t) => t.includes("select * from training_course_versions where id"),
        respond: () => [version({ status: "draft" })],
      },
      {
        match: (t) => t.includes("select * from training_courses where id"),
        respond: () => [course({ current_version_id: "old-version" })],
      },
      {
        match: (t) => t.includes("update training_course_versions set status = 'superseded'"),
        respond: () => [],
      },
      {
        match: (t) => t.includes("update training_course_versions set status = 'published'"),
        respond: () => [version({ status: "published" })],
      },
      {
        match: (t) => t.includes("update training_courses set current_version_id"),
        respond: () => [],
      },
      catchAllAudit,
    ]);

    const published = await publishCourseVersion("version-1");

    expect(published.status).toBe("published");
    expect(
      fakeSql.calls.some((c) =>
        c.text.includes("update training_course_versions set status = 'superseded'"),
      ),
    ).toBe(true);
  });
});
