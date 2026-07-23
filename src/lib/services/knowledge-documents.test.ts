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
import { AppError } from "@/lib/errors";
import { archiveDocument, createDocument, restoreDocument } from "./knowledge-documents";

function wireTenantContext(handlers: FakeQueryHandler[] = []) {
  const fakeSql = createFakeSql(handlers);
  vi.mocked(withTenantContext).mockImplementation(async (_ctx, fn) =>
    fn(asTransactionSql(fakeSql)),
  );
  return fakeSql;
}

const DEPARTMENT_ID = "11111111-1111-4111-8111-111111111111";

describe("knowledge-documents service", () => {
  beforeEach(() => {
    vi.mocked(getCurrentMembership).mockReset();
    vi.mocked(requirePermission).mockReset();
  });

  it("creates a document shell when the caller holds knowledge.create, scoped to the target department", async () => {
    const membership = makeMembership({ permissions: ["knowledge.create"] });
    vi.mocked(requirePermission).mockResolvedValue(membership);
    const fakeSql = wireTenantContext([
      {
        match: (t) => t.includes("insert into knowledge_documents"),
        respond: () => [{ id: "doc-1", title: "Fire Safety", department_id: DEPARTMENT_ID }],
      },
    ]);

    const document = await createDocument({ title: "Fire Safety", departmentId: DEPARTMENT_ID });

    expect(document).toEqual({ id: "doc-1", title: "Fire Safety", department_id: DEPARTMENT_ID });
    expect(requirePermission).toHaveBeenCalledWith("knowledge.create", {
      scope: { departmentId: DEPARTMENT_ID },
    });
    expect(fakeSql.calls.some((c) => c.text.includes("insert into audit_events"))).toBe(true);
  });

  it("rejects creating a document when the caller lacks knowledge.create in that department's scope", async () => {
    vi.mocked(requirePermission).mockRejectedValue(
      new AppError("forbidden", "Missing permission: knowledge.create"),
    );
    wireTenantContext();

    await expect(
      createDocument({ title: "Fire Safety", departmentId: DEPARTMENT_ID }),
    ).rejects.toThrow("Missing permission");
  });

  it("scopes archive/restore to the document's own department", async () => {
    const preCheck = makeMembership();
    vi.mocked(getCurrentMembership).mockResolvedValue(preCheck);
    vi.mocked(requirePermission).mockResolvedValue(
      makeMembership({ permissions: ["knowledge.edit"] }),
    );
    wireTenantContext([
      {
        match: (t) => t.includes("select * from knowledge_documents where id"),
        respond: () => [{ id: "doc-1", department_id: DEPARTMENT_ID, archived_at: null }],
      },
      {
        match: (t) => t.includes("update knowledge_documents set archived_at = now()"),
        respond: () => [
          { id: "doc-1", department_id: DEPARTMENT_ID, archived_at: "2026-01-01T00:00:00.000Z" },
        ],
      },
    ]);

    await archiveDocument("doc-1");

    expect(requirePermission).toHaveBeenCalledWith("knowledge.edit", {
      scope: { departmentId: DEPARTMENT_ID },
    });
  });

  it("restores an archived document to 'published' when its current version was published, or 'draft' otherwise", async () => {
    const preCheck = makeMembership();
    vi.mocked(getCurrentMembership).mockResolvedValue(preCheck);
    vi.mocked(requirePermission).mockResolvedValue(
      makeMembership({ permissions: ["knowledge.edit"] }),
    );
    const fakeSql = wireTenantContext([
      {
        match: (t) => t.includes("select * from knowledge_documents where id"),
        respond: () => [
          {
            id: "doc-1",
            department_id: DEPARTMENT_ID,
            archived_at: "2026-01-01T00:00:00.000Z",
            current_version_id: "ver-1",
          },
        ],
      },
      {
        match: (t) => t.includes("select * from document_versions where id"),
        respond: () => [{ id: "ver-1", status: "published" }],
      },
      {
        match: (t) => t.includes("update knowledge_documents set archived_at = null"),
        respond: (values) => [{ id: "doc-1", status: values[0] }],
      },
    ]);

    await restoreDocument("doc-1");

    const updateCall = fakeSql.calls.find((c) =>
      c.text.includes("update knowledge_documents set archived_at = null"),
    );
    expect(updateCall?.values).toContain("published");
  });
});
