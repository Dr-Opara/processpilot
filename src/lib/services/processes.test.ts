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
import { AppError } from "@/lib/errors";
import { archiveProcess, createProcess, restoreProcess } from "./processes";

function wireTenantContext(handlers: FakeQueryHandler[] = []) {
  const fakeSql = createFakeSql(handlers);
  vi.mocked(withTenantContext).mockImplementation(async (_ctx, fn) =>
    fn(asTransactionSql(fakeSql)),
  );
  return fakeSql;
}

const DEPARTMENT_ID = "11111111-1111-4111-8111-111111111111";

describe("processes service", () => {
  beforeEach(() => {
    vi.mocked(getCurrentMembership).mockReset();
    vi.mocked(requirePermission).mockReset();
  });

  it("creates a process shell when the caller holds process.create, scoped to the target department", async () => {
    const membership = makeMembership({ permissions: ["process.create"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    const fakeSql = wireTenantContext([
      {
        match: (t) => t.includes("insert into processes"),
        respond: () => [{ id: "proc-1", title: "Open a new store", department_id: DEPARTMENT_ID }],
      },
    ]);

    const process = await createProcess({ title: "Open a new store", departmentId: DEPARTMENT_ID });

    expect(process).toEqual({
      id: "proc-1",
      title: "Open a new store",
      department_id: DEPARTMENT_ID,
    });
    expect(requirePermission).toHaveBeenCalledWith("process.create", {
      scope: { departmentId: DEPARTMENT_ID },
    });
    expect(fakeSql.calls.some((c) => c.text.includes("insert into audit_events"))).toBe(true);
  });

  it("rejects creating a process when the caller lacks process.create in that department's scope", async () => {
    vi.mocked(requirePermission).mockRejectedValue(
      new AppError("forbidden", "Missing permission: process.create"),
    );
    wireTenantContext();

    await expect(
      createProcess({ title: "Open a new store", departmentId: DEPARTMENT_ID }),
    ).rejects.toThrow("Missing permission");
  });

  it("scopes archive/restore to the process's own department", async () => {
    const preCheck = makeMembership();
    vi.mocked(getCurrentMembership).mockResolvedValue(preCheck);
    vi.mocked(requirePermission).mockResolvedValue(
      makeMembership({ permissions: ["process.edit"] }),
    );
    wireTenantContext([
      {
        match: (t) => t.includes("select * from processes where id"),
        respond: () => [{ id: "proc-1", department_id: DEPARTMENT_ID, archived_at: null }],
      },
      {
        match: (t) => t.includes("update processes set archived_at = now()"),
        respond: () => [
          { id: "proc-1", department_id: DEPARTMENT_ID, archived_at: "2026-01-01T00:00:00.000Z" },
        ],
      },
    ]);

    await archiveProcess("proc-1");

    expect(requirePermission).toHaveBeenCalledWith("process.edit", {
      scope: { departmentId: DEPARTMENT_ID },
    });
  });

  it("restores an archived process to 'published' when its current version was published, or 'draft' otherwise", async () => {
    const preCheck = makeMembership();
    vi.mocked(getCurrentMembership).mockResolvedValue(preCheck);
    vi.mocked(requirePermission).mockResolvedValue(
      makeMembership({ permissions: ["process.edit"] }),
    );
    const fakeSql = wireTenantContext([
      {
        match: (t) => t.includes("select * from processes where id"),
        respond: () => [
          {
            id: "proc-1",
            department_id: DEPARTMENT_ID,
            archived_at: "2026-01-01T00:00:00.000Z",
            current_version_id: "ver-1",
          },
        ],
      },
      {
        match: (t) => t.includes("select * from process_versions where id"),
        respond: () => [{ id: "ver-1", status: "published" }],
      },
      {
        match: (t) => t.includes("update processes set archived_at = null"),
        respond: (values) => [{ id: "proc-1", status: values[0] }],
      },
    ]);

    await restoreProcess("proc-1");

    const updateCall = fakeSql.calls.find((c) =>
      c.text.includes("update processes set archived_at = null"),
    );
    expect(updateCall?.values).toContain("published");
  });
});
