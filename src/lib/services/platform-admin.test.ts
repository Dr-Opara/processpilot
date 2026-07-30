import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/platform-admin", () => ({ requirePlatformAdmin: vi.fn() }));
vi.mock("@/lib/observability/health", () => ({
  getQueueHealth: vi.fn().mockResolvedValue({
    pendingCount: 0,
    oldestPendingAgeSeconds: null,
    deadLetterCountLast24h: 0,
    processingCount: 0,
  }),
  getProviderConfigurationStatus: vi.fn().mockReturnValue([]),
}));

const adminState = vi.hoisted(() => ({
  sql: undefined as unknown as ReturnType<typeof import("@/lib/db/test-helpers/fake-sql").asSql>,
}));
vi.mock("@/lib/db/client-admin", () => ({ getAdminSql: () => adminState.sql }));

import { requirePlatformAdmin } from "@/lib/platform-admin";
import { createFakeSql, asSql, type FakeQueryHandler } from "@/lib/db/test-helpers/fake-sql";
import { AppError } from "@/lib/errors";
import {
  addSupportNote,
  lookupUserByEmail,
  reactivateOrganization,
  suspendOrganization,
} from "./platform-admin";

const ADMIN = {
  id: "admin-profile-1",
  email: "admin@example.com",
  clerk_user_id: "user_admin",
  first_name: null,
  last_name: null,
  avatar_url: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  deleted_at: null,
};

function wireAdminSql(handlers: FakeQueryHandler[] = []) {
  const fakeSql = createFakeSql(handlers);
  adminState.sql = asSql(fakeSql);
  return fakeSql;
}

describe("platform-admin service", () => {
  beforeEach(() => {
    vi.mocked(requirePlatformAdmin).mockReset();
  });

  it("propagates forbidden for every function when the caller isn't a platform admin", async () => {
    vi.mocked(requirePlatformAdmin).mockRejectedValue(
      new AppError("forbidden", "Platform administration access is required."),
    );
    wireAdminSql();

    await expect(lookupUserByEmail("someone@example.com")).rejects.toThrow(AppError);
    await expect(
      suspendOrganization({ organizationId: "11111111-1111-4111-8111-111111111111", reason: "x" }),
    ).rejects.toThrow(AppError);
  });

  it("suspends an organization: inserts the suspension row and sets organizations.archived_at", async () => {
    vi.mocked(requirePlatformAdmin).mockResolvedValue(ADMIN as never);
    const fakeSql = wireAdminSql([
      {
        match: (t) => t.includes("select * from organizations where id"),
        respond: () => [{ id: "11111111-1111-4111-8111-111111111111" }],
      },
      {
        match: (t) => t.includes("insert into platform_suspensions"),
        respond: () => [
          {
            id: "susp-1",
            organization_id: "11111111-1111-4111-8111-111111111111",
            suspended_at: "2026-08-08T00:00:00.000Z",
          },
        ],
      },
      { match: (t) => t.includes("update organizations set archived_at"), respond: () => [] },
      { match: (t) => t.includes("insert into platform_admin_audit_log"), respond: () => [] },
    ]);

    await suspendOrganization({
      organizationId: "11111111-1111-4111-8111-111111111111",
      reason: "Fraud investigation",
    });

    expect(fakeSql.calls.some((c) => c.text.includes("update organizations set archived_at"))).toBe(
      true,
    );
    expect(fakeSql.calls.some((c) => c.text.includes("insert into platform_admin_audit_log"))).toBe(
      true,
    );
  });

  it("rejects suspending an organization that already has an active suspension", async () => {
    vi.mocked(requirePlatformAdmin).mockResolvedValue(ADMIN as never);
    wireAdminSql([
      {
        match: (t) => t.includes("select * from organizations where id"),
        respond: () => [{ id: "11111111-1111-4111-8111-111111111111" }],
      },
      {
        match: (t) => t.includes("insert into platform_suspensions"),
        respond: () => {
          throw new Error("duplicate key value violates unique constraint");
        },
      },
    ]);

    await expect(
      suspendOrganization({
        organizationId: "11111111-1111-4111-8111-111111111111",
        reason: "Already suspended",
      }),
    ).rejects.toThrow(/already has an active suspension/i);
  });

  it("reactivates an organization: clears archived_at and marks the suspension reactivated", async () => {
    vi.mocked(requirePlatformAdmin).mockResolvedValue(ADMIN as never);
    const fakeSql = wireAdminSql([
      {
        match: (t) => t.includes("update platform_suspensions set reactivated_by"),
        respond: () => [{ id: "susp-1", organization_id: "11111111-1111-4111-8111-111111111111" }],
      },
      {
        match: (t) => t.includes("update organizations set archived_at = null"),
        respond: () => [],
      },
      { match: (t) => t.includes("insert into platform_admin_audit_log"), respond: () => [] },
    ]);

    await reactivateOrganization("11111111-1111-4111-8111-111111111111");

    expect(
      fakeSql.calls.some((c) => c.text.includes("update organizations set archived_at = null")),
    ).toBe(true);
  });

  it("rejects reactivating an organization with no active suspension", async () => {
    vi.mocked(requirePlatformAdmin).mockResolvedValue(ADMIN as never);
    wireAdminSql([
      {
        match: (t) => t.includes("update platform_suspensions set reactivated_by"),
        respond: () => [],
      },
    ]);

    await expect(reactivateOrganization("11111111-1111-4111-8111-111111111111")).rejects.toThrow(
      /no active suspension/i,
    );
  });

  it("adds a support note and audits it", async () => {
    vi.mocked(requirePlatformAdmin).mockResolvedValue(ADMIN as never);
    const fakeSql = wireAdminSql([
      {
        match: (t) => t.includes("insert into platform_support_notes"),
        respond: () => [
          {
            id: "note-1",
            organization_id: "11111111-1111-4111-8111-111111111111",
            note: "Called customer",
          },
        ],
      },
      { match: (t) => t.includes("insert into platform_admin_audit_log"), respond: () => [] },
    ]);

    const note = await addSupportNote({
      organizationId: "11111111-1111-4111-8111-111111111111",
      note: "Called customer",
    });

    expect(note.note).toBe("Called customer");
    expect(fakeSql.calls.some((c) => c.text.includes("insert into platform_admin_audit_log"))).toBe(
      true,
    );
  });

  it("returns null from lookupUserByEmail when no profile matches (never fabricates a result)", async () => {
    vi.mocked(requirePlatformAdmin).mockResolvedValue(ADMIN as never);
    wireAdminSql([{ match: (t) => t.includes("select id, email"), respond: () => [] }]);

    const result = await lookupUserByEmail("nobody@example.com");

    expect(result).toBeNull();
  });
});
