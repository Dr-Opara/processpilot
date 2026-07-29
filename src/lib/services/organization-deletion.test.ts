import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz", () => ({
  requirePermission: vi.fn(),
  getCurrentMembership: vi.fn(),
}));
vi.mock("@/lib/db/tenant-context", () => ({
  withTenantContext: vi.fn(),
}));
vi.mock("@/lib/jobs/enqueue", () => ({
  enqueueJob: vi.fn().mockResolvedValue({ id: "job-1" }),
}));

import { requirePermission } from "@/lib/authz";
import { withTenantContext } from "@/lib/db/tenant-context";
import { enqueueJob } from "@/lib/jobs/enqueue";
import {
  createFakeSql,
  asTransactionSql,
  type FakeQueryHandler,
} from "@/lib/db/test-helpers/fake-sql";
import { makeMembership } from "@/lib/db/test-helpers/service-fixtures";
import { AppError } from "@/lib/errors";
import {
  requestOrganizationDeletion,
  isOrganizationDeletionEnabled,
} from "./organization-deletion";

function wireTenantContext(handlers: FakeQueryHandler[] = []) {
  const fakeSql = createFakeSql(handlers);
  vi.mocked(withTenantContext).mockImplementation(async (_ctx, fn) =>
    fn(asTransactionSql(fakeSql)),
  );
  return fakeSql;
}

describe("organization-deletion service", () => {
  beforeEach(() => {
    vi.mocked(requirePermission).mockReset();
    vi.mocked(enqueueJob).mockClear();
  });

  it("rejects a deletion request when the typed confirmation doesn't match the org name", async () => {
    const membership = makeMembership({
      permissions: ["organization.manage"],
      organization: { name: "Acme Co" },
    });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext();

    await expect(requestOrganizationDeletion({ confirmationOrgName: "Not Acme" })).rejects.toThrow(
      /type the organization's exact name/i,
    );
    expect(enqueueJob).not.toHaveBeenCalled();
  });

  it("schedules a grace-period sweep job when the confirmation matches", async () => {
    const membership = makeMembership({
      permissions: ["organization.manage"],
      organization: { name: "Acme Co" },
    });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext([
      {
        match: (t) => t.includes("insert into organization_deletion_requests"),
        respond: () => [{ id: "request-1", status: "pending" }],
      },
    ]);

    const request = await requestOrganizationDeletion({ confirmationOrgName: "Acme Co" });

    expect(request.id).toBe("request-1");
    expect(enqueueJob).toHaveBeenCalledWith(
      expect.anything(),
      membership.organization.id,
      expect.objectContaining({ jobType: "organization-deletion-sweep" }),
    );
  });

  it("propagates a forbidden error for a caller without organization.manage", async () => {
    vi.mocked(requirePermission).mockRejectedValue(
      new AppError("forbidden", "Missing permission: organization.manage"),
    );
    wireTenantContext();

    await expect(requestOrganizationDeletion({ confirmationOrgName: "Acme Co" })).rejects.toThrow(
      "Missing permission",
    );
  });

  it("is disabled by default (no ORGANIZATION_DELETION_ENABLED env var)", () => {
    expect(isOrganizationDeletionEnabled()).toBe(false);
  });
});
