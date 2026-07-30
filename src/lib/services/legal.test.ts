import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz", () => ({ getCurrentMembership: vi.fn() }));
vi.mock("@/lib/db/tenant-context", () => ({ withTenantContext: vi.fn() }));

import { getCurrentMembership } from "@/lib/authz";
import { withTenantContext } from "@/lib/db/tenant-context";
import {
  createFakeSql,
  asTransactionSql,
  type FakeQueryHandler,
} from "@/lib/db/test-helpers/fake-sql";
import { makeMembership } from "@/lib/db/test-helpers/service-fixtures";
import { AppError } from "@/lib/errors";
import { exportMyData, getTermsAcceptance, recordTermsAcceptance } from "./legal";

function wireTenantContext(handlers: FakeQueryHandler[] = []) {
  const fakeSql = createFakeSql(handlers);
  vi.mocked(withTenantContext).mockImplementation(async (_ctx, fn) =>
    fn(asTransactionSql(fakeSql)),
  );
  return fakeSql;
}

describe("legal service", () => {
  beforeEach(() => {
    vi.mocked(getCurrentMembership).mockReset();
  });

  describe("getTermsAcceptance", () => {
    it("reports not accepted when no legal.termsAcceptedAt is stored", async () => {
      vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
      wireTenantContext([
        {
          match: (t) => t.includes("select * from organization_settings"),
          respond: () => [{ organization_id: "org-1", settings: {} }],
        },
      ]);

      const result = await getTermsAcceptance();

      expect(result.accepted).toBe(false);
      expect(result.version).toBeNull();
    });

    it("reports accepted with the stored version and date", async () => {
      vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
      wireTenantContext([
        {
          match: (t) => t.includes("select * from organization_settings"),
          respond: () => [
            {
              organization_id: "org-1",
              settings: {
                legal: {
                  termsAcceptedAt: "2026-08-06T00:00:00.000Z",
                  termsAcceptedVersion: "0.2.0",
                  termsAcceptedByProfileId: "profile-1",
                },
              },
            },
          ],
        },
      ]);

      const result = await getTermsAcceptance();

      expect(result.accepted).toBe(true);
      expect(result.version).toBe("0.2.0");
    });

    it("throws not_found when organization settings are missing", async () => {
      vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
      wireTenantContext([
        { match: (t) => t.includes("select * from organization_settings"), respond: () => [] },
      ]);

      await expect(getTermsAcceptance()).rejects.toThrow(AppError);
    });
  });

  describe("recordTermsAcceptance", () => {
    it("records the current version and audits the acceptance", async () => {
      vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
      const fakeSql = wireTenantContext([
        { match: (t) => t.includes("update organization_settings set"), respond: () => [] },
      ]);

      await recordTermsAcceptance();

      expect(fakeSql.calls.some((c) => c.text.includes("insert into audit_events"))).toBe(true);
    });

    it("records an explicitly-passed version", async () => {
      vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
      const fakeSql = wireTenantContext([
        { match: (t) => t.includes("update organization_settings set"), respond: () => [] },
      ]);

      await recordTermsAcceptance({ version: "1.0.0" });

      const updateCall = fakeSql.calls.find((c) =>
        c.text.includes("update organization_settings set"),
      );
      expect(JSON.stringify(updateCall?.values)).toContain("1.0.0");
    });
  });

  describe("exportMyData", () => {
    it("returns only the calling member's own profile, membership, and activity", async () => {
      const membership = makeMembership({ profile: { email: "member@example.com" } });
      vi.mocked(getCurrentMembership).mockResolvedValue(membership);
      const fakeSql = wireTenantContext([
        {
          match: (t) => t.includes("select r.name from member_role_assignments"),
          respond: () => [{ name: "employee" }],
        },
        {
          match: (t) => t.includes("select action, created_at from audit_events"),
          respond: () => [
            { action: "member.role_changed", created_at: "2026-08-01T00:00:00.000Z" },
          ],
        },
      ]);

      const result = await exportMyData();

      expect(result.profile.email).toBe("member@example.com");
      expect(result.membership.roles).toEqual(["employee"]);
      expect(result.recentActivity).toHaveLength(1);
      const activityCall = fakeSql.calls.find((c) =>
        c.text.includes("select action, created_at from audit_events"),
      );
      expect(activityCall?.values).toContain(membership.profile.id);
      expect(fakeSql.calls.some((c) => c.text.includes("insert into audit_events"))).toBe(true);
    });
  });
});
