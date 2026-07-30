import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz", () => ({
  getCurrentMembership: vi.fn(),
  requirePermission: vi.fn(),
}));
vi.mock("@/lib/db/tenant-context", () => ({
  withTenantContext: vi.fn(),
}));

import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { withTenantContext } from "@/lib/db/tenant-context";
import {
  createFakeSql,
  asTransactionSql,
  type FakeQueryHandler,
} from "@/lib/db/test-helpers/fake-sql";
import { makeMembership } from "@/lib/db/test-helpers/service-fixtures";
import { isAiCopilotEnabledForOrg, setAiCopilotEnabled } from "./ai-settings";

function wireTenantContext(handlers: FakeQueryHandler[] = []) {
  const fakeSql = createFakeSql(handlers);
  vi.mocked(withTenantContext).mockImplementation(async (_ctx, fn) =>
    fn(asTransactionSql(fakeSql)),
  );
  return fakeSql;
}

const ORIGINAL_KEY = process.env.ANTHROPIC_API_KEY;

beforeEach(() => {
  vi.mocked(getCurrentMembership).mockReset();
  vi.mocked(requirePermission).mockReset();
});

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = ORIGINAL_KEY;
});

describe("isAiCopilotEnabledForOrg", () => {
  it("is false when the AI adapter has no real credential, regardless of the org's flag", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(await isAiCopilotEnabledForOrg()).toBe(false);
  });

  it("defaults to true once configured, when no flag row exists yet", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-api03-real-looking-value";
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    wireTenantContext([{ match: (t) => t.includes("from feature_flags"), respond: () => [] }]);

    expect(await isAiCopilotEnabledForOrg()).toBe(true);
  });

  it("respects an explicit disable flag", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-api03-real-looking-value";
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    wireTenantContext([
      { match: (t) => t.includes("from feature_flags"), respond: () => [{ enabled: false }] },
    ]);

    expect(await isAiCopilotEnabledForOrg()).toBe(false);
  });

  it("is false for the demo organization, even with a real credential and no explicit disable", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-api03-real-looking-value";
    vi.mocked(getCurrentMembership).mockResolvedValue(
      makeMembership({ organization: { is_demo: true } }),
    );

    expect(await isAiCopilotEnabledForOrg()).toBe(false);
  });
});

describe("setAiCopilotEnabled", () => {
  it("requires ai.configure", async () => {
    vi.mocked(requirePermission).mockRejectedValue(new Error("forbidden"));
    await expect(setAiCopilotEnabled(true)).rejects.toThrow();
  });

  it("upserts the flag", async () => {
    const membership = makeMembership({ permissions: ["ai.configure"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    const fakeSql = wireTenantContext([
      { match: (t) => t.includes("insert into feature_flags"), respond: () => [] },
    ]);

    await setAiCopilotEnabled(false);

    expect(fakeSql.calls.some((c) => c.text.includes("insert into feature_flags"))).toBe(true);
  });
});
