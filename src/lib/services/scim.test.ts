import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz", () => ({ requirePermission: vi.fn() }));
vi.mock("@/lib/db/tenant-context", () => ({ withTenantContext: vi.fn() }));

const adminState = vi.hoisted(() => ({
  sql: undefined as unknown as ReturnType<typeof import("@/lib/db/test-helpers/fake-sql").asSql>,
}));
vi.mock("@/lib/db/client-admin", () => ({ getAdminSql: () => adminState.sql }));

import { requirePermission } from "@/lib/authz";
import { withTenantContext } from "@/lib/db/tenant-context";
import {
  createFakeSql,
  asTransactionSql,
  asSql,
  type FakeQueryHandler,
} from "@/lib/db/test-helpers/fake-sql";
import { makeMembership } from "@/lib/db/test-helpers/service-fixtures";
import { createScimToken, listScimUsers, verifyScimToken } from "./scim";

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

describe("scim service", () => {
  beforeEach(() => {
    vi.mocked(requirePermission).mockReset();
  });

  it("never returns a token whose stored status is not active", async () => {
    wireAdminSql([{ match: (t) => t.includes("select * from scim_tokens"), respond: () => [] }]);

    const result = await verifyScimToken("pp_scim_whatever");

    expect(result).toBeNull();
  });

  it("rejects a raw token without the expected prefix before touching the database", async () => {
    const fakeSql = wireAdminSql();

    const result = await verifyScimToken("not-a-scim-token");

    expect(result).toBeNull();
    expect(fakeSql.calls).toHaveLength(0);
  });

  it("issues a token whose raw value is never persisted, only its hash", async () => {
    const membership = makeMembership({ permissions: ["integration.manage"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    const fakeSql = wireTenantContext([
      {
        match: (t) => t.includes("insert into scim_tokens"),
        respond: () => [{ id: "token-1", name: "Okta" }],
      },
    ]);

    const { rawToken } = await createScimToken({ name: "Okta" });

    expect(rawToken.startsWith("pp_scim_")).toBe(true);
    const insertCall = fakeSql.calls.find((c) => c.text.includes("insert into scim_tokens"));
    expect(insertCall?.values.some((v) => v === rawToken)).toBe(false);
  });

  it("scopes listed users to the token's own organization only", async () => {
    const fakeSql = wireAdminSql([
      {
        match: (t) => t.includes("from organization_members om"),
        respond: () => [
          {
            id: "member-1",
            email: "a@example.com",
            first_name: "A",
            last_name: "B",
            status: "active",
          },
        ],
      },
      { match: (t) => t.includes("select count(*) as total"), respond: () => [{ total: "1" }] },
    ]);

    const { users, totalResults } = await listScimUsers("org-1", { startIndex: 1, count: 20 });

    expect(users).toHaveLength(1);
    expect(totalResults).toBe(1);
    const listCall = fakeSql.calls.find((c) => c.text.includes("from organization_members om"));
    expect(listCall?.values).toContain("org-1");
  });
});
