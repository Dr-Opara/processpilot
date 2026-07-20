import { describe, expect, it, vi } from "vitest";
import { asSql, createFakeSql } from "./test-helpers/fake-sql";
import {
  syncMembershipRemoved,
  syncMembershipUpserted,
  syncOrganizationUpserted,
  syncUserUpserted,
} from "./identity-sync";

vi.mock("server-only", () => ({}));

const CLERK_USER = {
  id: "user_test123",
  email_addresses: [{ id: "idn_primary", email_address: "ada@northstar.example" }],
  primary_email_address_id: "idn_primary",
  first_name: "Ada",
  last_name: "Lovelace",
  image_url: "https://example.test/avatar.png",
};

describe("syncUserUpserted", () => {
  it("upserts a profile keyed by clerk_user_id (on conflict), not a plain insert", () => {
    const sql = createFakeSql([
      {
        match: (text) => text.includes("insert into profiles"),
        respond: (values) => [
          {
            id: "profile-1",
            clerk_user_id: values[0],
            email: values[1],
            first_name: values[2],
            last_name: values[3],
            avatar_url: values[4],
            created_at: "2026-07-19T00:00:00Z",
            updated_at: "2026-07-19T00:00:00Z",
            deleted_at: null,
          },
        ],
      },
    ]);

    return syncUserUpserted(asSql(sql), CLERK_USER).then((profile) => {
      expect(profile.clerk_user_id).toBe("user_test123");
      expect(profile.email).toBe("ada@northstar.example");
      const query = sql.calls[0].text;
      expect(query).toContain("insert into profiles");
      expect(query).toContain("on conflict");
    });
  });

  it("is idempotent: replaying the same event twice does not throw", async () => {
    const sql = createFakeSql([
      {
        match: (text) => text.includes("insert into profiles"),
        respond: (values) => [
          {
            id: "profile-1",
            clerk_user_id: values[0],
            email: values[1],
            first_name: values[2],
            last_name: values[3],
            avatar_url: values[4],
            created_at: "2026-07-19T00:00:00Z",
            updated_at: "2026-07-19T00:00:00Z",
            deleted_at: null,
          },
        ],
      },
    ]);

    const first = await syncUserUpserted(asSql(sql), CLERK_USER);
    const second = await syncUserUpserted(asSql(sql), CLERK_USER);

    expect(first.id).toBe(second.id);
    expect(first.email).toBe(second.email);
  });

  it("refuses to sync a user with no email address at all", async () => {
    const sql = createFakeSql([]);
    const userWithNoEmail = { ...CLERK_USER, email_addresses: [], primary_email_address_id: null };

    await expect(syncUserUpserted(asSql(sql), userWithNoEmail)).rejects.toThrow(
      /no email address/i,
    );
  });
});

describe("syncOrganizationUpserted", () => {
  const CLERK_ORG = {
    id: "org_test123",
    name: "Northstar Property Group",
    slug: "northstar",
    created_by: "user_test123",
  };

  function sqlWithOrgHandlers() {
    return createFakeSql([
      { match: (t) => t.includes("select id from profiles"), respond: () => [{ id: "profile-1" }] },
      {
        match: (t) => t.includes("insert into organizations"),
        respond: (values) => [
          {
            id: "org-1",
            clerk_org_id: values[0],
            name: values[1],
            slug: values[2],
            created_at: "2026-07-19T00:00:00Z",
            updated_at: "2026-07-19T00:00:00Z",
            created_by: values[3],
            archived_at: null,
          },
        ],
      },
      { match: (t) => t.includes("insert into organization_settings"), respond: () => [] },
      { match: (t) => t.includes("insert into audit_events"), respond: () => [{ id: "audit-1" }] },
    ]);
  }

  it("creates the organization, its settings row, and an audit event", async () => {
    const sql = sqlWithOrgHandlers();

    const organization = await syncOrganizationUpserted(asSql(sql), CLERK_ORG, "evt_2");

    expect(organization.clerk_org_id).toBe("org_test123");
    expect(sql.calls.some((c) => c.text.includes("insert into organizations"))).toBe(true);
    expect(sql.calls.some((c) => c.text.includes("insert into organization_settings"))).toBe(true);
    expect(sql.calls.some((c) => c.text.includes("insert into audit_events"))).toBe(true);
  });

  it("is idempotent: replaying the same event twice resolves to the same organization id", async () => {
    const sql = sqlWithOrgHandlers();

    const first = await syncOrganizationUpserted(asSql(sql), CLERK_ORG, "evt_2");
    const second = await syncOrganizationUpserted(asSql(sql), CLERK_ORG, "evt_2_retry");

    expect(first.id).toBe(second.id);
  });
});

describe("syncMembershipUpserted", () => {
  const MEMBERSHIP = {
    id: "orgmem_test123",
    role: "org:admin",
    organization: { id: "org_test123" },
    public_user_data: { user_id: "user_test123" },
  };

  it("throws a clear error when the profile or organization hasn't synced yet", async () => {
    const sql = createFakeSql([
      { match: (t) => t.includes("select id from profiles"), respond: () => [] },
      { match: (t) => t.includes("select id from organizations"), respond: () => [] },
    ]);

    await expect(syncMembershipUpserted(asSql(sql), MEMBERSHIP, "evt_3")).rejects.toThrow(
      /profile or organization not yet synced/i,
    );
  });

  it("upserts the membership and records an audit event once both exist", async () => {
    const sql = createFakeSql([
      { match: (t) => t.includes("select id from profiles"), respond: () => [{ id: "profile-1" }] },
      {
        match: (t) => t.includes("select id from organizations"),
        respond: () => [{ id: "org-1" }],
      },
      {
        match: (t) => t.includes("insert into organization_members"),
        respond: () => [
          {
            id: "member-1",
            organization_id: "org-1",
            profile_id: "profile-1",
            clerk_membership_id: "orgmem_test123",
            clerk_role: "org:admin",
            status: "active",
            created_at: "2026-07-19T00:00:00Z",
            updated_at: "2026-07-19T00:00:00Z",
            created_by: null,
          },
        ],
      },
      { match: (t) => t.includes("insert into audit_events"), respond: () => [{ id: "audit-1" }] },
    ]);

    const member = await syncMembershipUpserted(asSql(sql), MEMBERSHIP, "evt_3");

    expect(member.organization_id).toBe("org-1");
    expect(member.status).toBe("active");
  });
});

describe("syncMembershipRemoved", () => {
  const MEMBERSHIP = {
    id: "orgmem_test123",
    role: "org:admin",
    organization: { id: "org_test123" },
    public_user_data: { user_id: "user_test123" },
  };

  it("returns null when the membership row doesn't exist (already removed / never synced)", async () => {
    const sql = createFakeSql([
      { match: (t) => t.includes("update organization_members"), respond: () => [] },
    ]);

    const result = await syncMembershipRemoved(asSql(sql), MEMBERSHIP, "evt_4");

    expect(result).toBeNull();
  });

  it("marks the membership removed and returns its organization id", async () => {
    const sql = createFakeSql([
      {
        match: (t) => t.includes("update organization_members"),
        respond: () => [{ id: "member-1", organization_id: "org-1" }],
      },
      { match: (t) => t.includes("insert into audit_events"), respond: () => [{ id: "audit-1" }] },
    ]);

    const result = await syncMembershipRemoved(asSql(sql), MEMBERSHIP, "evt_4");

    expect(result).toEqual({ organizationId: "org-1" });
  });
});
