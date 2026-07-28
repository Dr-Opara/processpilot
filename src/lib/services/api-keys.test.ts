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
import { AppError } from "@/lib/errors";
import { checkRateLimit, createApiKey, hashApiKey, revokeApiKey, verifyApiKey } from "./api-keys";

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

beforeEach(() => {
  vi.mocked(requirePermission).mockReset();
});

describe("createApiKey", () => {
  it("returns the raw key exactly once, alongside the stored (hashed) row", async () => {
    vi.mocked(requirePermission).mockResolvedValue(
      makeMembership({ permissions: ["integration.manage"] }),
    );
    const fakeSql = wireTenantContext([
      {
        match: (t) => t.includes("insert into api_keys"),
        respond: (values) => [
          {
            id: "key-1",
            organization_id: "org-1",
            name: "CI key",
            key_prefix: String(values[2]).slice(0, 16),
            key_hash: values[3],
            scopes: ["processes:read"],
            status: "active",
            expires_at: null,
            last_used_at: null,
            created_by: "profile-1",
            created_at: "2026-08-04T00:00:00.000Z",
            revoked_at: null,
          },
        ],
      },
      { match: (t) => t.includes("insert into audit_events"), respond: () => [{ id: "audit-1" }] },
    ]);

    const created = await createApiKey({ name: "CI key", scopes: ["processes:read"] });

    expect(created.rawKey).toMatch(/^pp_live_/);
    expect(created.row.key_hash).toBe(hashApiKey(created.rawKey));
    expect(fakeSql.calls.some((c) => c.text.includes("insert into audit_events"))).toBe(true);
  });
});

describe("revokeApiKey", () => {
  it("throws not_found when there's no matching active key", async () => {
    vi.mocked(requirePermission).mockResolvedValue(
      makeMembership({ permissions: ["integration.manage"] }),
    );
    wireTenantContext([{ match: (t) => t.includes("update api_keys"), respond: () => [] }]);

    await expect(revokeApiKey("key-1")).rejects.toThrow(AppError);
  });
});

describe("verifyApiKey", () => {
  it("rejects a value with the wrong prefix without querying the database", async () => {
    const fakeSql = wireAdminSql([]);
    expect(await verifyApiKey("not-a-processpilot-key")).toBeNull();
    expect(fakeSql.calls).toHaveLength(0);
  });

  it("returns null for a key with no matching active row", async () => {
    wireAdminSql([{ match: (t) => t.includes("from api_keys"), respond: () => [] }]);
    expect(await verifyApiKey("pp_live_doesnotexist")).toBeNull();
  });

  it("returns the authenticated key and touches last_used_at on a match", async () => {
    wireAdminSql([
      {
        match: (t) => t.includes("from api_keys"),
        respond: () => [
          {
            id: "key-1",
            organization_id: "org-1",
            scopes: ["processes:read"],
            status: "active",
            created_by: "profile-1",
          },
        ],
      },
      { match: (t) => t.includes("update api_keys set last_used_at"), respond: () => [] },
    ]);

    const result = await verifyApiKey("pp_live_realvalue");

    expect(result).toEqual({
      apiKeyId: "key-1",
      organizationId: "org-1",
      scopes: ["processes:read"],
      createdByProfileId: "profile-1",
    });
  });
});

describe("checkRateLimit", () => {
  it("flags limited once the trailing-window count reaches the cap", async () => {
    wireAdminSql([
      { match: (t) => t.includes("from api_key_usage_log"), respond: () => [{ count: "60" }] },
    ]);
    expect((await checkRateLimit("key-1")).limited).toBe(true);
  });

  it("is not limited below the cap", async () => {
    wireAdminSql([
      { match: (t) => t.includes("from api_key_usage_log"), respond: () => [{ count: "3" }] },
    ]);
    expect((await checkRateLimit("key-1")).limited).toBe(false);
  });
});
