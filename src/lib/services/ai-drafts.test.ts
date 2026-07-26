import { describe, it, expect, vi, beforeEach } from "vitest";

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
import { acceptAiDraft, createAiDraft, dismissAiDraft } from "./ai-drafts";
import { AppError } from "@/lib/errors";
import type { AiDraftRow } from "@/lib/db/database.types";

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

function draft(overrides: Partial<AiDraftRow> = {}): AiDraftRow {
  return {
    id: "draft-1",
    organization_id: "org-1",
    department_id: null,
    draft_type: "qa_answer",
    source_type: null,
    source_id: null,
    prompt_summary: "Q&A: test",
    output: { answer: "test" },
    model: "claude-sonnet-5",
    input_tokens: 10,
    output_tokens: 20,
    status: "pending",
    accepted_resource_type: null,
    accepted_resource_id: null,
    decided_at: null,
    decided_by: null,
    created_at: new Date().toISOString(),
    created_by: "member-1",
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(getCurrentMembership).mockReset();
  vi.mocked(requirePermission).mockReset();
});

describe("createAiDraft", () => {
  it("inserts the draft, records usage, and records an audit event", async () => {
    const fakeSql = createFakeSql([
      { match: (t) => t.includes("insert into ai_drafts"), respond: () => [draft()] },
      { match: (t) => t.includes("insert into ai_usage_events"), respond: () => [] },
      catchAllAudit,
    ]);

    const created = await createAiDraft(asTransactionSql(fakeSql), {
      organizationId: "org-1",
      draftType: "qa_answer",
      promptSummary: "Q&A: test",
      output: { answer: "test" },
      model: "claude-sonnet-5",
      inputTokens: 10,
      outputTokens: 20,
      createdByMemberId: "member-1",
    });

    expect(created.id).toBe("draft-1");
    expect(fakeSql.calls.some((c) => c.text.includes("insert into ai_usage_events"))).toBe(true);
    expect(fakeSql.calls.some((c) => c.text.includes("insert into audit_events"))).toBe(true);
  });
});

describe("acceptAiDraft / dismissAiDraft", () => {
  it("rejects deciding an already-decided draft", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    wireTenantContext([
      {
        match: (t) => t.includes("select * from ai_drafts where id"),
        respond: () => [draft({ status: "accepted" })],
      },
    ]);

    await expect(acceptAiDraft("draft-1")).rejects.toThrow(AppError);
    await expect(dismissAiDraft("draft-1")).rejects.toThrow(AppError);
  });

  it("accepts a pending draft, recording the resulting real resource for traceability", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    const membership = makeMembership({ permissions: ["ai.use"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    const fakeSql = wireTenantContext([
      {
        match: (t) => t.includes("select * from ai_drafts where id"),
        respond: () => [draft({ status: "pending" })],
      },
      {
        match: (t) => t.includes("update ai_drafts set"),
        respond: () => [
          draft({
            status: "accepted",
            accepted_resource_type: "process_version",
            accepted_resource_id: "pv-1",
          }),
        ],
      },
      catchAllAudit,
    ]);

    const updated = await acceptAiDraft("draft-1", {
      resourceType: "process_version",
      resourceId: "pv-1",
    });

    expect(updated.status).toBe("accepted");
    expect(updated.accepted_resource_id).toBe("pv-1");
    expect(fakeSql.calls.some((c) => c.text.includes("insert into audit_events"))).toBe(true);
  });

  it("dismisses a pending draft", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    const membership = makeMembership({ permissions: ["ai.use"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    wireTenantContext([
      {
        match: (t) => t.includes("select * from ai_drafts where id"),
        respond: () => [draft({ status: "pending" })],
      },
      {
        match: (t) => t.includes("update ai_drafts set"),
        respond: () => [draft({ status: "dismissed" })],
      },
      catchAllAudit,
    ]);

    const updated = await dismissAiDraft("draft-1");
    expect(updated.status).toBe("dismissed");
  });
});
