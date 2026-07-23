import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz", () => ({
  requirePermission: vi.fn(),
}));
vi.mock("@/lib/db/tenant-context", () => ({
  withTenantContext: vi.fn(),
}));

import { requirePermission } from "@/lib/authz";
import { withTenantContext } from "@/lib/db/tenant-context";
import {
  createFakeSql,
  asTransactionSql,
  type FakeQueryHandler,
} from "@/lib/db/test-helpers/fake-sql";
import { makeMembership } from "@/lib/db/test-helpers/service-fixtures";
import { AppError } from "@/lib/errors";
import { archiveLocation, createLocation, restoreLocation } from "./locations";

function wireTenantContext(handlers: FakeQueryHandler[] = []) {
  const fakeSql = createFakeSql(handlers);
  vi.mocked(withTenantContext).mockImplementation(async (_ctx, fn) =>
    fn(asTransactionSql(fakeSql)),
  );
  return fakeSql;
}

describe("locations service", () => {
  beforeEach(() => {
    vi.mocked(requirePermission).mockReset();
  });

  it("creates a location when the caller holds location.manage (org-wide, never scoped)", async () => {
    const membership = makeMembership({ permissions: ["location.manage"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    const fakeSql = wireTenantContext([
      { match: (t) => t.includes("select id from organization_locations"), respond: () => [] },
      {
        match: (t) => t.includes("insert into organization_locations"),
        respond: () => [{ id: "loc-1", name: "Downtown Store", archived_at: null }],
      },
    ]);

    const location = await createLocation({ name: "Downtown Store" });

    expect(location).toEqual({ id: "loc-1", name: "Downtown Store", archived_at: null });
    expect(requirePermission).toHaveBeenCalledWith("location.manage");
    expect(fakeSql.calls.some((c) => c.text.includes("insert into audit_events"))).toBe(true);
  });

  it("rejects creation when the caller lacks location.manage", async () => {
    vi.mocked(requirePermission).mockRejectedValue(
      new AppError("forbidden", "Missing permission: location.manage"),
    );
    wireTenantContext();

    await expect(createLocation({ name: "Downtown Store" })).rejects.toThrow("Missing permission");
  });

  it("rejects creating a location whose name is already active", async () => {
    const membership = makeMembership({ permissions: ["location.manage"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext([
      {
        match: (t) => t.includes("select id from organization_locations"),
        respond: () => [{ id: "loc-existing" }],
      },
    ]);

    await expect(createLocation({ name: "Downtown Store" })).rejects.toThrow("already exists");
  });

  it("rejects archiving a location that does not exist in this organization", async () => {
    const membership = makeMembership({ permissions: ["location.manage"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext([
      {
        match: (t) => t.includes("update organization_locations set archived_at = now()"),
        respond: () => [],
      },
    ]);

    await expect(archiveLocation("loc-missing")).rejects.toThrow("not found or already archived");
  });

  it("rejects restoring a location whose name collides with an active location", async () => {
    const membership = makeMembership({ permissions: ["location.manage"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext([
      {
        match: (t) => t.includes("select * from organization_locations where id"),
        respond: () => [
          { id: "loc-1", name: "Downtown Store", archived_at: "2026-01-01T00:00:00.000Z" },
        ],
      },
      {
        match: (t) => t.includes("select id from organization_locations") && t.includes("id <>"),
        respond: () => [{ id: "loc-2" }],
      },
    ]);

    await expect(restoreLocation("loc-1")).rejects.toThrow("already uses this name");
  });
});
