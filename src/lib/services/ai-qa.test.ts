import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz", () => ({
  getCurrentMembership: vi.fn(),
  requirePermission: vi.fn(),
}));
vi.mock("@/lib/db/tenant-context", () => ({
  withTenantContext: vi.fn(),
}));
vi.mock("@/lib/services/ai-settings", () => ({
  isAiCopilotEnabledForOrg: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/ai/get-provider", () => ({
  getAiProvider: vi.fn(),
}));

import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { withTenantContext } from "@/lib/db/tenant-context";
import { isAiCopilotEnabledForOrg } from "@/lib/services/ai-settings";
import { getAiProvider } from "@/lib/ai/get-provider";
import {
  createFakeSql,
  asTransactionSql,
  type FakeQueryHandler,
} from "@/lib/db/test-helpers/fake-sql";
import { makeMembership } from "@/lib/db/test-helpers/service-fixtures";
import { askQuestion } from "./ai-qa";
import { AppError } from "@/lib/errors";

function wireTenantContext(handlers: FakeQueryHandler[] = []) {
  const fakeSql = createFakeSql(handlers);
  vi.mocked(withTenantContext).mockImplementation(async (_ctx, fn) =>
    fn(asTransactionSql(fakeSql)),
  );
  return fakeSql;
}

const catchAllAudit: FakeQueryHandler = {
  match: (t) => t.includes("insert into audit_events"),
  respond: () => [{ id: "audit-1" }],
};

const ORIGINAL_KEY = process.env.ANTHROPIC_API_KEY;

beforeEach(() => {
  vi.mocked(getCurrentMembership).mockReset();
  vi.mocked(requirePermission).mockReset();
  vi.mocked(isAiCopilotEnabledForOrg).mockResolvedValue(true);
  process.env.ANTHROPIC_API_KEY = "sk-ant-api03-real-looking-value";
});

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = ORIGINAL_KEY;
});

describe("askQuestion", () => {
  it("is unavailable when the AI adapter has no real credential", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(askQuestion({ question: "How do I onboard a vendor?" })).rejects.toThrow(AppError);
  });

  it("is unavailable when the organization has disabled the copilot", async () => {
    vi.mocked(requirePermission).mockResolvedValue(makeMembership({ permissions: ["ai.use"] }));
    vi.mocked(isAiCopilotEnabledForOrg).mockResolvedValue(false);

    await expect(askQuestion({ question: "How do I onboard a vendor?" })).rejects.toThrow(
      "disabled",
    );
  });

  it("answers with no citations when no source documents match", async () => {
    const membership = makeMembership({ permissions: ["ai.use"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext([
      { match: (t) => t.includes("from knowledge_documents kd"), respond: () => [] },
      {
        match: (t) => t.includes("insert into ai_drafts"),
        respond: () => [{ id: "draft-1", output: {} }],
      },
      { match: (t) => t.includes("insert into ai_usage_events"), respond: () => [] },
      catchAllAudit,
    ]);

    const result = await askQuestion({ question: "How do I onboard a vendor?" });

    expect(result.citations).toEqual([]);
    expect(getAiProvider).not.toHaveBeenCalled();
  });

  it("filters out a hallucinated citation the model claims but that wasn't retrieved", async () => {
    const membership = makeMembership({ permissions: ["ai.use"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    vi.mocked(getAiProvider).mockReturnValue({
      name: "anthropic",
      complete: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          answer: "Follow the vendor onboarding checklist.",
          citedSourceIds: ["doc-1", "doc-999-hallucinated"],
        }),
        model: "claude-sonnet-5",
        inputTokens: 100,
        outputTokens: 50,
      }),
    });
    const fakeSql = wireTenantContext([
      {
        match: (t) => t.includes("from knowledge_documents kd"),
        respond: () => [
          {
            id: "doc-1",
            version_id: "v-1",
            content: "Vendor onboarding checklist...",
            extracted_text: null,
            title: "Vendor Onboarding",
          },
        ],
      },
      {
        match: (t) => t.includes("insert into ai_drafts"),
        respond: () => [{ id: "draft-1", output: {} }],
      },
      { match: (t) => t.includes("insert into ai_usage_events"), respond: () => [] },
      catchAllAudit,
    ]);

    const result = await askQuestion({ question: "How do I onboard a vendor?" });

    expect(result.answer).toBe("Follow the vendor onboarding checklist.");
    expect(result.citations).toEqual([{ documentId: "doc-1", title: "Vendor Onboarding" }]);
    expect(fakeSql.calls.some((c) => c.text.includes("insert into ai_drafts"))).toBe(true);
  });
});
