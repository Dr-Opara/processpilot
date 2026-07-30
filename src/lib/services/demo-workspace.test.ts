import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/platform-admin", () => ({ requirePlatformAdmin: vi.fn() }));

const adminState = vi.hoisted(() => ({
  sql: undefined as unknown as ReturnType<typeof import("@/lib/db/test-helpers/fake-sql").asSql>,
}));
vi.mock("@/lib/db/client-admin", () => ({ getAdminSql: () => adminState.sql }));

import { requirePlatformAdmin } from "@/lib/platform-admin";
import { createFakeSql, asSql, type FakeQueryHandler } from "@/lib/db/test-helpers/fake-sql";
import { AppError } from "@/lib/errors";
import {
  markOrganizationAsDemo,
  resetDemoWorkspace,
  seedDemoWorkspaceContent,
  unmarkOrganizationAsDemo,
} from "./demo-workspace";

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

const ORG_ID = "22222222-2222-4222-8222-222222222222";

function wireAdminSql(handlers: FakeQueryHandler[] = []) {
  const fakeSql = createFakeSql(handlers);
  adminState.sql = asSql(fakeSql);
  return fakeSql;
}

describe("demo-workspace service", () => {
  beforeEach(() => {
    vi.mocked(requirePlatformAdmin).mockReset();
  });

  it("propagates forbidden for every function when the caller isn't a platform admin", async () => {
    vi.mocked(requirePlatformAdmin).mockRejectedValue(
      new AppError("forbidden", "Platform administration access is required."),
    );
    wireAdminSql();

    await expect(markOrganizationAsDemo(ORG_ID)).rejects.toThrow(AppError);
    await expect(unmarkOrganizationAsDemo(ORG_ID)).rejects.toThrow(AppError);
    await expect(seedDemoWorkspaceContent(ORG_ID)).rejects.toThrow(AppError);
    await expect(resetDemoWorkspace()).rejects.toThrow(AppError);
  });

  it("markOrganizationAsDemo rejects an unknown organization id", async () => {
    vi.mocked(requirePlatformAdmin).mockResolvedValue(ADMIN as never);
    wireAdminSql([
      { match: (t) => t.includes("select * from organizations where id"), respond: () => [] },
    ]);

    await expect(markOrganizationAsDemo(ORG_ID)).rejects.toThrow(/not found/i);
  });

  it("markOrganizationAsDemo converts a unique-constraint conflict into a clear error", async () => {
    vi.mocked(requirePlatformAdmin).mockResolvedValue(ADMIN as never);
    wireAdminSql([
      {
        match: (t) => t.includes("select * from organizations where id"),
        respond: () => [{ id: ORG_ID, is_demo: false }],
      },
      {
        match: (t) => t.includes("update organizations set is_demo = true"),
        respond: () => {
          throw new Error("duplicate key value violates unique constraint");
        },
      },
    ]);

    await expect(markOrganizationAsDemo(ORG_ID)).rejects.toThrow(/already exists/i);
  });

  it("unmarkOrganizationAsDemo rejects an organization that isn't the demo workspace", async () => {
    vi.mocked(requirePlatformAdmin).mockResolvedValue(ADMIN as never);
    wireAdminSql([
      { match: (t) => t.includes("update organizations set is_demo = false"), respond: () => [] },
    ]);

    await expect(unmarkOrganizationAsDemo(ORG_ID)).rejects.toThrow(/not the demo workspace/i);
  });

  it("unmarkOrganizationAsDemo clears the flag and audits it", async () => {
    vi.mocked(requirePlatformAdmin).mockResolvedValue(ADMIN as never);
    const fakeSql = wireAdminSql([
      {
        match: (t) => t.includes("update organizations set is_demo = false"),
        respond: () => [{ id: ORG_ID, is_demo: false }],
      },
      { match: (t) => t.includes("insert into platform_admin_audit_log"), respond: () => [] },
    ]);

    await unmarkOrganizationAsDemo(ORG_ID);

    expect(fakeSql.calls.some((c) => c.text.includes("insert into platform_admin_audit_log"))).toBe(
      true,
    );
  });

  it("seedDemoWorkspaceContent refuses to seed an organization that isn't flagged demo", async () => {
    vi.mocked(requirePlatformAdmin).mockResolvedValue(ADMIN as never);
    wireAdminSql([
      {
        match: (t) => t.includes("select * from organizations where id"),
        respond: () => [{ id: ORG_ID, is_demo: false }],
      },
    ]);

    await expect(seedDemoWorkspaceContent(ORG_ID)).rejects.toThrow(/not flagged/i);
  });

  it("seedDemoWorkspaceContent inserts published baseline content for a flagged demo organization", async () => {
    vi.mocked(requirePlatformAdmin).mockResolvedValue(ADMIN as never);
    const fakeSql = wireAdminSql([
      {
        match: (t) => t.includes("select * from organizations where id"),
        respond: () => [{ id: ORG_ID, is_demo: true }],
      },
      {
        match: (t) => t.includes("select id, current_version_id from knowledge_documents"),
        respond: () => [],
      },
      {
        match: (t) => t.includes("insert into knowledge_documents"),
        respond: () => [{ id: "doc-1", current_version_id: null }],
      },
      {
        match: (t) => t.includes("insert into document_versions"),
        respond: () => [{ id: "docv-1" }],
      },
      {
        match: (t) => t.includes("select id, current_version_id from processes"),
        respond: () => [],
      },
      {
        match: (t) => t.includes("insert into processes"),
        respond: () => [{ id: "proc-1", current_version_id: null }],
      },
      {
        match: (t) => t.includes("insert into process_versions"),
        respond: () => [{ id: "procv-1" }],
      },
      { match: () => true, respond: () => [] },
    ]);

    await seedDemoWorkspaceContent(ORG_ID);

    expect(
      fakeSql.calls.some(
        (c) => c.text.includes("insert into knowledge_documents") && c.text.includes("published"),
      ),
    ).toBe(true);
    expect(
      fakeSql.calls.some(
        (c) => c.text.includes("insert into process_versions") && c.text.includes("published"),
      ),
    ).toBe(true);
  });

  it("resetDemoWorkspace rejects when no organization is currently flagged demo", async () => {
    vi.mocked(requirePlatformAdmin).mockResolvedValue(ADMIN as never);
    wireAdminSql([{ match: (t) => t.includes("where is_demo = true"), respond: () => [] }]);

    await expect(resetDemoWorkspace()).rejects.toThrow(/no demo organization/i);
  });
});
