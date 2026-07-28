import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz", () => ({
  requirePermission: vi.fn(),
}));
vi.mock("@/lib/db/tenant-context", () => ({
  withTenantContext: vi.fn(),
}));

const createEnterpriseConnection = vi.fn();
const updateEnterpriseConnection = vi.fn();
const deleteEnterpriseConnection = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn(async () => ({
    enterpriseConnections: {
      createEnterpriseConnection,
      updateEnterpriseConnection,
      deleteEnterpriseConnection,
    },
  })),
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
import {
  createSsoConnection,
  deleteSsoConnection,
  listSsoConnections,
  setSsoConnectionActive,
} from "./sso";

function wireTenantContext(handlers: FakeQueryHandler[] = []) {
  const fakeSql = createFakeSql(handlers);
  vi.mocked(withTenantContext).mockImplementation(async (_ctx, fn) =>
    fn(asTransactionSql(fakeSql)),
  );
  return fakeSql;
}

function connectionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "conn-1",
    organization_id: "org-1",
    clerk_connection_id: "ec_1",
    name: "Acme Okta",
    provider: "saml_custom",
    domain: "acme.com",
    active: true,
    created_at: "2026-08-03T00:00:00.000Z",
    updated_at: "2026-08-03T00:00:00.000Z",
    created_by: "profile-1",
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(requirePermission).mockReset();
  createEnterpriseConnection.mockReset();
  updateEnterpriseConnection.mockReset();
  deleteEnterpriseConnection.mockReset();
});

describe("listSsoConnections", () => {
  it("requires integration.manage and lists the org's connections", async () => {
    vi.mocked(requirePermission).mockResolvedValue(
      makeMembership({ permissions: ["integration.manage"] }),
    );
    wireTenantContext([
      { match: (t) => t.includes("from sso_connections"), respond: () => [connectionRow()] },
    ]);

    const connections = await listSsoConnections();

    expect(connections).toHaveLength(1);
  });
});

describe("createSsoConnection", () => {
  const samlInput = {
    name: "Acme Okta",
    domain: "acme.com",
    provider: "saml_custom" as const,
    saml: {
      idpEntityId: "https://idp.example.com/entity",
      idpSsoUrl: "https://idp.example.com/sso",
      idpCertificate: "-----BEGIN CERTIFICATE-----\nMIIB...\n-----END CERTIFICATE-----",
    },
  };

  it("rejects a saml_custom connection missing both certificate and metadata URL", async () => {
    vi.mocked(requirePermission).mockResolvedValue(
      makeMembership({ permissions: ["integration.manage"] }),
    );

    await expect(
      createSsoConnection({ name: "X", domain: "acme.com", provider: "saml_custom" }),
    ).rejects.toThrow();
  });

  it("rejects a domain already registered for this organization", async () => {
    vi.mocked(requirePermission).mockResolvedValue(
      makeMembership({ permissions: ["integration.manage"] }),
    );
    wireTenantContext([
      {
        match: (t) => t.includes("from sso_connections where"),
        respond: () => [{ id: "conn-existing" }],
      },
    ]);

    await expect(createSsoConnection(samlInput)).rejects.toThrow(AppError);
    expect(createEnterpriseConnection).not.toHaveBeenCalled();
  });

  it("creates the Clerk enterprise connection, then a local row that stores no IdP secret material", async () => {
    vi.mocked(requirePermission).mockResolvedValue(
      makeMembership({ permissions: ["integration.manage"] }),
    );
    createEnterpriseConnection.mockResolvedValue({ id: "ec_new" });
    const fakeSql = wireTenantContext([
      { match: (t) => t.includes("from sso_connections where"), respond: () => [] },
      {
        match: (t) => t.includes("insert into sso_connections"),
        respond: () => [connectionRow({ clerk_connection_id: "ec_new" })],
      },
      { match: (t) => t.includes("insert into audit_events"), respond: () => [{ id: "audit-1" }] },
    ]);

    const row = await createSsoConnection(samlInput);

    expect(row.clerk_connection_id).toBe("ec_new");
    expect(createEnterpriseConnection).toHaveBeenCalledWith(
      expect.objectContaining({ domains: ["acme.com"] }),
    );
    const insertCall = fakeSql.calls.find((c) => c.text.includes("insert into sso_connections"));
    expect(insertCall?.text).not.toContain("idpCertificate");
    expect(JSON.stringify(insertCall?.values)).not.toContain("BEGIN CERTIFICATE");
  });

  it("wraps a Clerk API failure in an AppError and never inserts a local row", async () => {
    vi.mocked(requirePermission).mockResolvedValue(
      makeMembership({ permissions: ["integration.manage"] }),
    );
    createEnterpriseConnection.mockRejectedValue(
      new Error("Clerk plan does not support this feature"),
    );
    wireTenantContext([
      { match: (t) => t.includes("from sso_connections where"), respond: () => [] },
    ]);

    await expect(createSsoConnection(samlInput)).rejects.toThrow(AppError);
  });
});

describe("setSsoConnectionActive", () => {
  it("updates Clerk then the local row", async () => {
    vi.mocked(requirePermission).mockResolvedValue(
      makeMembership({ permissions: ["integration.manage"] }),
    );
    wireTenantContext([
      {
        match: (t) => t.includes("select * from sso_connections"),
        respond: () => [connectionRow()],
      },
      {
        match: (t) => t.includes("update sso_connections"),
        respond: () => [connectionRow({ active: false })],
      },
      { match: (t) => t.includes("insert into audit_events"), respond: () => [{ id: "audit-1" }] },
    ]);

    const updated = await setSsoConnectionActive("conn-1", false);

    expect(updated.active).toBe(false);
    expect(updateEnterpriseConnection).toHaveBeenCalledWith("ec_1", { active: false });
  });
});

describe("deleteSsoConnection", () => {
  it("throws not_found for a connection outside the caller's organization", async () => {
    vi.mocked(requirePermission).mockResolvedValue(
      makeMembership({ permissions: ["integration.manage"] }),
    );
    wireTenantContext([
      { match: (t) => t.includes("select * from sso_connections"), respond: () => [] },
    ]);

    await expect(deleteSsoConnection("conn-1")).rejects.toThrow(AppError);
    expect(deleteEnterpriseConnection).not.toHaveBeenCalled();
  });
});
