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

import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { withTenantContext } from "@/lib/db/tenant-context";
import { enqueueJob } from "@/lib/jobs/enqueue";
import {
  createFakeSql,
  asTransactionSql,
  type FakeQueryHandler,
} from "@/lib/db/test-helpers/fake-sql";
import { makeMembership } from "@/lib/db/test-helpers/service-fixtures";
import {
  expireCertification,
  issueCertification,
  renewCertification,
  revokeCertification,
} from "./certifications";
import type { CertificationRow } from "@/lib/db/database.types";

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

function certification(overrides: Partial<CertificationRow> = {}): CertificationRow {
  return {
    id: "cert-1",
    organization_id: "org-1",
    department_id: null,
    member_id: "member-1",
    course_id: "course-1",
    training_assignment_id: "assignment-1",
    issued_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 365 * 86_400_000).toISOString(),
    status: "active",
    renewed_from_certification_id: null,
    revoked_reason: null,
    revoked_by: null,
    revoked_at: null,
    created_at: new Date().toISOString(),
    created_by: "profile-1",
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(getCurrentMembership).mockReset();
  vi.mocked(requirePermission).mockReset();
  vi.mocked(enqueueJob).mockClear();
});

describe("issueCertification", () => {
  it("inserts a certification and schedules an expiry check when an expiry is given", async () => {
    const fakeSql = createFakeSql([
      { match: (t) => t.includes("insert into certifications"), respond: () => [certification()] },
      catchAllAudit,
    ]);

    const cert = await issueCertification(asTransactionSql(fakeSql), {
      organizationId: "org-1",
      memberId: "member-1",
      courseId: "course-1",
      trainingAssignmentId: "assignment-1",
      expiresAt: certification().expires_at,
    });

    expect(cert.id).toBe("cert-1");
    expect(enqueueJob).toHaveBeenCalledWith(
      expect.anything(),
      "org-1",
      expect.objectContaining({ jobType: "certification-expiry-check" }),
    );
  });

  it("does not schedule an expiry check for a non-expiring certification", async () => {
    const fakeSql = createFakeSql([
      {
        match: (t) => t.includes("insert into certifications"),
        respond: () => [certification({ expires_at: null })],
      },
      catchAllAudit,
    ]);

    await issueCertification(asTransactionSql(fakeSql), {
      organizationId: "org-1",
      memberId: "member-1",
      courseId: "course-1",
      trainingAssignmentId: "assignment-1",
      expiresAt: null,
    });

    expect(enqueueJob).not.toHaveBeenCalled();
  });
});

describe("renewCertification", () => {
  it("creates a new certification chained to the prior one", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    const membership = makeMembership({ permissions: ["training.manage"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    const newExpiresAt = new Date(Date.now() + 730 * 86_400_000).toISOString();
    const fakeSql = wireTenantContext([
      {
        match: (t) => t.includes("select * from certifications where id"),
        respond: () => [certification()],
      },
      {
        match: (t) => t.includes("insert into certifications"),
        respond: () => [
          certification({
            id: "cert-2",
            renewed_from_certification_id: "cert-1",
            expires_at: newExpiresAt,
          }),
        ],
      },
      catchAllAudit,
    ]);

    const renewed = await renewCertification("cert-1", newExpiresAt);
    expect(renewed.renewed_from_certification_id).toBe("cert-1");
    expect(fakeSql.calls.some((c) => c.text.includes("insert into certifications"))).toBe(true);
  });
});

describe("revokeCertification", () => {
  it("requires a reason", async () => {
    await expect(revokeCertification("cert-1", "  ")).rejects.toThrow("reason is required");
  });

  it("only revokes an active certification", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    wireTenantContext([
      {
        match: (t) => t.includes("select * from certifications where id"),
        respond: () => [certification({ status: "expired" })],
      },
    ]);

    await expect(revokeCertification("cert-1", "Fraudulent submission")).rejects.toThrow(
      "Only an active",
    );
  });
});

describe("expireCertification (background job)", () => {
  it("is a no-op for a certification already revoked", async () => {
    const fakeSql = createFakeSql([
      {
        match: (t) => t.includes("select * from certifications"),
        respond: () => [certification({ status: "revoked" })],
      },
    ]);
    await expireCertification(asTransactionSql(fakeSql), "cert-1", "org-1");
    expect(fakeSql.calls.some((c) => c.text.includes("status = 'expired'"))).toBe(false);
  });

  it("expires an active certification past its expiry", async () => {
    const fakeSql = createFakeSql([
      {
        match: (t) => t.includes("select * from certifications"),
        respond: () => [certification({ expires_at: new Date(Date.now() - 1000).toISOString() })],
      },
      {
        match: (t) => t.includes("update certifications set status = 'expired'"),
        respond: () => [],
      },
      catchAllAudit,
    ]);
    await expireCertification(asTransactionSql(fakeSql), "cert-1", "org-1");
    expect(
      fakeSql.calls.some((c) => c.text.includes("update certifications set status = 'expired'")),
    ).toBe(true);
  });
});
