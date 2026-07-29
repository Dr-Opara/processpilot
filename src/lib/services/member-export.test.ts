import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz", () => ({
  getCurrentMembership: vi.fn(),
}));
vi.mock("@/lib/db/tenant-context", () => ({
  withTenantContext: vi.fn(),
}));

import { getCurrentMembership } from "@/lib/authz";
import { withTenantContext } from "@/lib/db/tenant-context";
import {
  createFakeSql,
  asTransactionSql,
  type FakeQueryHandler,
} from "@/lib/db/test-helpers/fake-sql";
import { makeMembership } from "@/lib/db/test-helpers/service-fixtures";
import { exportMembers } from "./member-export";

function wireTenantContext(handlers: FakeQueryHandler[] = []) {
  const fakeSql = createFakeSql(handlers);
  vi.mocked(withTenantContext).mockImplementation(async (_ctx, fn) =>
    fn(asTransactionSql(fakeSql)),
  );
  return fakeSql;
}

describe("member-export service", () => {
  beforeEach(() => {
    vi.mocked(getCurrentMembership).mockReset();
  });

  it("produces a CSV with a header row and one row per member", async () => {
    const membership = makeMembership();
    vi.mocked(getCurrentMembership).mockResolvedValue(membership);
    const fakeSql = wireTenantContext([
      {
        match: (t) => t.includes("from organization_members om"),
        respond: () => [
          {
            first_name: "Ada",
            last_name: "Owner",
            email: "owner@example.com",
            job_title: "Ops Lead",
            status: "active",
            location_name: "HQ",
            department_name: "Operations",
            role_names: ["organization_owner"],
          },
        ],
      },
    ]);

    const csv = await exportMembers();

    expect(csv.split("\n")[0]).toContain("First name");
    expect(csv).toContain("Ada");
    expect(csv).toContain("owner@example.com");
    expect(fakeSql.calls.some((c) => c.text.includes("insert into audit_events"))).toBe(true);
  });
});
