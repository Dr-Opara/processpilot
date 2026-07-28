import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz", () => ({ requirePermission: vi.fn() }));
vi.mock("@/lib/db/tenant-context", () => ({ withTenantContext: vi.fn() }));
vi.mock("@/lib/jobs/enqueue", () => ({ enqueueJob: vi.fn().mockResolvedValue({}) }));

const adminState = vi.hoisted(() => ({
  sql: undefined as unknown as ReturnType<typeof import("@/lib/db/test-helpers/fake-sql").asSql>,
}));
vi.mock("@/lib/db/client-admin", () => ({ getAdminSql: () => adminState.sql }));

const createOrganizationInvitation = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn(async () => ({
    organizations: { createOrganizationInvitation },
  })),
}));

import { requirePermission } from "@/lib/authz";
import { withTenantContext } from "@/lib/db/tenant-context";
import { enqueueJob } from "@/lib/jobs/enqueue";
import {
  createFakeSql,
  asTransactionSql,
  asSql,
  type FakeQueryHandler,
} from "@/lib/db/test-helpers/fake-sql";
import { makeMembership } from "@/lib/db/test-helpers/service-fixtures";
import { AppError } from "@/lib/errors";
import {
  activateExternalAccessGrant,
  expireExternalAccessGrant,
  inviteExternalUser,
  revokeExternalAccessGrant,
} from "./external-access";

function wireTenantContext(handlers: FakeQueryHandler[] = []) {
  const fakeSql = createFakeSql(handlers);
  vi.mocked(withTenantContext).mockImplementation(async (_ctx, fn) =>
    fn(asTransactionSql(fakeSql)),
  );
  return fakeSql;
}

function wireAdminSql(handlers: FakeQueryHandler[] = []) {
  const fakeSql = createFakeSql(handlers);
  adminState.sql = asSql(fakeSql);
  return fakeSql;
}

function taskRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "task-1",
    organization_id: "org-1",
    department_id: "dept-1",
    workflow_id: "wf-1",
    node_id: "node-1",
    node_type: "form",
    label: "Review documents",
    required: true,
    status: "assigned",
    assignee_member_id: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(requirePermission).mockReset();
  vi.mocked(enqueueJob).mockClear();
  createOrganizationInvitation.mockReset();
});

describe("inviteExternalUser", () => {
  it("throws when the task isn't open", async () => {
    vi.mocked(requirePermission).mockResolvedValue(
      makeMembership({ permissions: ["workflow.assign"] }),
    );
    wireTenantContext([
      {
        match: (t) => t.includes("from tasks where"),
        respond: () => [taskRow({ status: "completed" })],
      },
    ]);

    await expect(
      inviteExternalUser({
        taskId: "11111111-1111-4111-a111-111111111111",
        email: "contractor@example.com",
        expiresInDays: 7,
      }),
    ).rejects.toThrow(AppError);
  });

  it("throws when the task already has a live grant", async () => {
    vi.mocked(requirePermission).mockResolvedValue(
      makeMembership({ permissions: ["workflow.assign"] }),
    );
    wireTenantContext([
      { match: (t) => t.includes("from tasks where"), respond: () => [taskRow()] },
      {
        match: (t) => t.includes("from external_access_grants where task_id"),
        respond: () => [{ id: "grant-existing" }],
      },
    ]);

    await expect(
      inviteExternalUser({
        taskId: "11111111-1111-4111-a111-111111111111",
        email: "contractor@example.com",
        expiresInDays: 7,
      }),
    ).rejects.toThrow(AppError);
    expect(createOrganizationInvitation).not.toHaveBeenCalled();
  });

  it("creates the Clerk invitation, the organization_invitations row, and the grant", async () => {
    vi.mocked(requirePermission).mockResolvedValue(
      makeMembership({ permissions: ["workflow.assign"] }),
    );
    createOrganizationInvitation.mockResolvedValue({ id: "clerk_inv_1" });
    wireAdminSql([
      { match: (t) => t.includes("from roles where"), respond: () => [{ id: "role-external" }] },
    ]);
    const fakeSql = wireTenantContext([
      { match: (t) => t.includes("from tasks where"), respond: () => [taskRow()] },
      { match: (t) => t.includes("from external_access_grants where task_id"), respond: () => [] },
      {
        match: (t) => t.includes("insert into organization_invitations"),
        respond: () => [{ id: "invitation-1" }],
      },
      {
        match: (t) => t.includes("insert into external_access_grants"),
        respond: () => [
          {
            id: "grant-1",
            organization_id: "org-1",
            department_id: "dept-1",
            invitation_id: "invitation-1",
            task_id: "task-1",
            member_id: null,
            status: "pending",
            expires_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            accepted_at: null,
            revoked_at: null,
          },
        ],
      },
      { match: (t) => t.includes("insert into audit_events"), respond: () => [{ id: "audit-1" }] },
    ]);

    const grant = await inviteExternalUser({
      taskId: "11111111-1111-4111-a111-111111111111",
      email: "contractor@example.com",
      expiresInDays: 7,
    });

    expect(grant.status).toBe("pending");
    expect(fakeSql.calls.some((c) => c.text.includes("insert into external_access_grants"))).toBe(
      true,
    );
  });
});

describe("activateExternalAccessGrant", () => {
  it("is a no-op when there's no pending grant for the invitation", async () => {
    const fakeSql = createFakeSql([
      { match: (t) => t.includes("update external_access_grants"), respond: () => [] },
    ]);

    await activateExternalAccessGrant(
      asSql(fakeSql),
      "org-1",
      "invitation-1",
      "member-1",
      "corr-1",
    );

    expect(fakeSql.calls.some((c) => c.text.includes("update tasks"))).toBe(false);
    expect(enqueueJob).not.toHaveBeenCalled();
  });

  it("assigns the task, schedules expiration, and records an audit event", async () => {
    const fakeSql = createFakeSql([
      {
        match: (t) => t.includes("update external_access_grants"),
        respond: () => [
          {
            id: "grant-1",
            organization_id: "org-1",
            task_id: "task-1",
            member_id: "member-1",
            status: "active",
            expires_at: new Date(Date.now() + 86_400_000).toISOString(),
          },
        ],
      },
      { match: (t) => t.includes("update tasks set assignee_member_id"), respond: () => [] },
      { match: (t) => t.includes("insert into audit_events"), respond: () => [{ id: "audit-1" }] },
    ]);

    await activateExternalAccessGrant(
      asSql(fakeSql),
      "org-1",
      "invitation-1",
      "member-1",
      "corr-1",
    );

    expect(fakeSql.calls.some((c) => c.text.includes("update tasks set assignee_member_id"))).toBe(
      true,
    );
    expect(enqueueJob).toHaveBeenCalledWith(
      expect.anything(),
      "org-1",
      expect.objectContaining({ jobType: "external-access-expiration-check" }),
    );
  });
});

describe("revokeExternalAccessGrant", () => {
  it("throws not_found when there's no live grant", async () => {
    vi.mocked(requirePermission).mockResolvedValue(
      makeMembership({ permissions: ["workflow.assign"] }),
    );
    wireTenantContext([
      { match: (t) => t.includes("update external_access_grants"), respond: () => [] },
    ]);

    await expect(revokeExternalAccessGrant("grant-1")).rejects.toThrow(AppError);
  });

  it("suspends the accepted member when revoking an active grant", async () => {
    vi.mocked(requirePermission).mockResolvedValue(
      makeMembership({ permissions: ["workflow.assign"] }),
    );
    const fakeSql = wireTenantContext([
      {
        match: (t) => t.includes("update external_access_grants"),
        respond: () => [
          { id: "grant-1", organization_id: "org-1", member_id: "member-1", status: "revoked" },
        ],
      },
      {
        match: (t) => t.includes("update organization_members set status = 'suspended'"),
        respond: () => [],
      },
      { match: (t) => t.includes("insert into audit_events"), respond: () => [{ id: "audit-1" }] },
    ]);

    await revokeExternalAccessGrant("grant-1");

    expect(
      fakeSql.calls.some((c) =>
        c.text.includes("update organization_members set status = 'suspended'"),
      ),
    ).toBe(true);
  });
});

describe("expireExternalAccessGrant", () => {
  it("is a no-op for a grant that isn't past its expiry", async () => {
    const fakeSql = createFakeSql([
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

    await expireExternalAccessGrant(asSql(fakeSql), "grant-1", "org-1");

    expect(fakeSql.calls.some((c) => c.text.includes("update external_access_grants"))).toBe(false);
  });

  it("expires and suspends the member for a grant past its expiry", async () => {
    const fakeSql = createFakeSql([
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

    await expireExternalAccessGrant(asSql(fakeSql), "grant-1", "org-1");

    expect(
      fakeSql.calls.some((c) =>
        c.text.includes("update external_access_grants set status = 'expired'"),
      ),
    ).toBe(true);
  });
});
