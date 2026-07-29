import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz", () => ({
  requirePermission: vi.fn(),
}));
vi.mock("@/lib/db/tenant-context", () => ({
  withTenantContext: vi.fn(),
}));
vi.mock("node:dns/promises", () => {
  const resolveTxt = vi.fn();
  return { resolveTxt, default: { resolveTxt } };
});

import { requirePermission } from "@/lib/authz";
import { withTenantContext } from "@/lib/db/tenant-context";
import { resolveTxt } from "node:dns/promises";
import {
  createFakeSql,
  asTransactionSql,
  type FakeQueryHandler,
} from "@/lib/db/test-helpers/fake-sql";
import { makeMembership } from "@/lib/db/test-helpers/service-fixtures";
import { AppError } from "@/lib/errors";
import { addApprovedDomain, verifyApprovedDomain, verificationRecordFor } from "./approved-domains";

function wireTenantContext(handlers: FakeQueryHandler[] = []) {
  const fakeSql = createFakeSql(handlers);
  vi.mocked(withTenantContext).mockImplementation(async (_ctx, fn) =>
    fn(asTransactionSql(fakeSql)),
  );
  return fakeSql;
}

describe("approved-domains service", () => {
  beforeEach(() => {
    vi.mocked(requirePermission).mockReset();
    vi.mocked(resolveTxt).mockReset();
  });

  it("rejects an invalid domain", async () => {
    const membership = makeMembership({ permissions: ["organization.settings"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext();

    await expect(addApprovedDomain({ domain: "not a domain" })).rejects.toThrow();
  });

  it("never marks a domain verified without a matching real DNS TXT record", async () => {
    const membership = makeMembership({ permissions: ["organization.settings"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext([
      {
        match: (t) => t.includes("select * from approved_domains"),
        respond: () => [{ id: "domain-1", domain: "example.com", verification_token: "abc123" }],
      },
    ]);
    vi.mocked(resolveTxt).mockRejectedValue(new Error("ENOTFOUND"));

    await expect(verifyApprovedDomain("domain-1")).rejects.toThrow(/no matching txt record/i);
  });

  it("marks a domain verified when the DNS TXT record matches exactly", async () => {
    const membership = makeMembership({ permissions: ["organization.settings"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    const record = verificationRecordFor("example.com", "abc123");
    vi.mocked(resolveTxt).mockResolvedValue([[record.value]]);
    const fakeSql = wireTenantContext([
      {
        match: (t) => t.includes("select * from approved_domains"),
        respond: () => [{ id: "domain-1", domain: "example.com", verification_token: "abc123" }],
      },
      {
        match: (t) => t.includes("update approved_domains set verified_at"),
        respond: () => [
          { id: "domain-1", domain: "example.com", verified_at: "2026-08-06T00:00:00Z" },
        ],
      },
    ]);

    const result = await verifyApprovedDomain("domain-1");

    expect(result.verified_at).not.toBeNull();
    expect(fakeSql.calls.some((c) => c.text.includes("insert into audit_events"))).toBe(true);
  });

  it("propagates a forbidden error when the caller lacks organization.settings", async () => {
    vi.mocked(requirePermission).mockRejectedValue(
      new AppError("forbidden", "Missing permission: organization.settings"),
    );
    wireTenantContext();

    await expect(addApprovedDomain({ domain: "example.com" })).rejects.toThrow(
      "Missing permission",
    );
  });
});
