import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz", () => ({ requirePermission: vi.fn() }));
vi.mock("@/lib/db/tenant-context", () => ({ withTenantContext: vi.fn() }));
vi.mock("@/lib/crypto/secret-box", () => ({
  isEncryptionConfigured: vi.fn(),
  encryptSecret: vi.fn((value: string) => `enc(${value})`),
  decryptSecret: vi.fn((value: string) => value.replace(/^enc\(/, "").replace(/\)$/, "")),
}));

import { requirePermission } from "@/lib/authz";
import { withTenantContext } from "@/lib/db/tenant-context";
import { isEncryptionConfigured } from "@/lib/crypto/secret-box";
import {
  createFakeSql,
  asTransactionSql,
  type FakeQueryHandler,
} from "@/lib/db/test-helpers/fake-sql";
import { makeMembership } from "@/lib/db/test-helpers/service-fixtures";
import { AppError } from "@/lib/errors";
import {
  connectWithApiKey,
  disconnectIntegration,
  getConnectAuthorizationUrl,
  listIntegrations,
  verifyIntegration,
} from "./integration-connections";

function wireTenantContext(handlers: FakeQueryHandler[] = []) {
  const fakeSql = createFakeSql(handlers);
  vi.mocked(withTenantContext).mockImplementation(async (_ctx, fn) =>
    fn(asTransactionSql(fakeSql)),
  );
  return fakeSql;
}

beforeEach(() => {
  vi.mocked(requirePermission).mockReset();
  vi.mocked(isEncryptionConfigured).mockReset();
});

describe("listIntegrations", () => {
  it("merges the static catalog with the org's connection rows", async () => {
    vi.mocked(requirePermission).mockResolvedValue(
      makeMembership({ permissions: ["integration.manage"] }),
    );
    wireTenantContext([
      {
        match: (t) => t.includes("from integration_connections"),
        respond: () => [
          { id: "conn-1", organization_id: "org-1", provider: "slack", status: "connected" },
        ],
      },
    ]);

    const catalog = await listIntegrations();

    expect(catalog).toHaveLength(7);
    const slack = catalog.find((entry) => entry.provider === "slack");
    expect(slack?.implemented).toBe(true);
    expect(slack?.connection?.status).toBe("connected");
    const teams = catalog.find((entry) => entry.provider === "microsoft_teams");
    expect(teams?.implemented).toBe(false);
    expect(teams?.connection).toBeNull();
  });
});

describe("getConnectAuthorizationUrl", () => {
  it("throws for a not-yet-implemented provider", async () => {
    vi.mocked(requirePermission).mockResolvedValue(
      makeMembership({ permissions: ["integration.manage"] }),
    );

    await expect(
      getConnectAuthorizationUrl("jira", "https://app.example.com/callback"),
    ).rejects.toThrow(AppError);
  });

  it("throws when credential storage isn't configured", async () => {
    vi.mocked(requirePermission).mockResolvedValue(
      makeMembership({ permissions: ["integration.manage"] }),
    );
    vi.mocked(isEncryptionConfigured).mockReturnValue(false);

    await expect(
      getConnectAuthorizationUrl("slack", "https://app.example.com/callback"),
    ).rejects.toThrow(AppError);
  });
});

describe("connectWithApiKey", () => {
  it("rejects an empty key", async () => {
    vi.mocked(requirePermission).mockResolvedValue(
      makeMembership({ permissions: ["integration.manage"] }),
    );

    await expect(connectWithApiKey("slack", "  ")).rejects.toThrow(AppError);
  });

  it("throws for a provider whose auth type isn't api_key", async () => {
    vi.mocked(requirePermission).mockResolvedValue(
      makeMembership({ permissions: ["integration.manage"] }),
    );

    await expect(connectWithApiKey("slack", "some-key")).rejects.toThrow(AppError);
  });
});

describe("disconnectIntegration", () => {
  it("throws not_found when the provider isn't connected", async () => {
    vi.mocked(requirePermission).mockResolvedValue(
      makeMembership({ permissions: ["integration.manage"] }),
    );
    wireTenantContext([
      { match: (t) => t.includes("update integration_connections"), respond: () => [] },
    ]);

    await expect(disconnectIntegration("slack")).rejects.toThrow(AppError);
  });

  it("clears credentials and records an audit event on success", async () => {
    vi.mocked(requirePermission).mockResolvedValue(
      makeMembership({ permissions: ["integration.manage"] }),
    );
    const fakeSql = wireTenantContext([
      {
        match: (t) => t.includes("update integration_connections"),
        respond: () => [
          { id: "conn-1", organization_id: "org-1", provider: "slack", status: "disconnected" },
        ],
      },
      { match: (t) => t.includes("insert into audit_events"), respond: () => [{ id: "audit-1" }] },
    ]);

    await disconnectIntegration("slack");

    expect(fakeSql.calls.some((c) => c.text.includes("insert into audit_events"))).toBe(true);
  });
});

describe("verifyIntegration", () => {
  it("throws not_found when there is nothing connected to verify", async () => {
    vi.mocked(requirePermission).mockResolvedValue(
      makeMembership({ permissions: ["integration.manage"] }),
    );
    wireTenantContext([
      { match: (t) => t.includes("select * from integration_connections"), respond: () => [] },
    ]);

    await expect(verifyIntegration("slack")).rejects.toThrow(AppError);
  });
});
