import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz", () => ({
  requirePermission: vi.fn(),
}));
vi.mock("@/lib/db/tenant-context", () => ({
  withTenantContext: vi.fn(),
}));

const { mockUploadFile, mockCreateSignedUrl, mockBuildStoragePath } = vi.hoisted(() => ({
  mockUploadFile: vi.fn(),
  mockCreateSignedUrl: vi.fn(),
  mockBuildStoragePath: vi.fn(() => "org-1/doc-1/ver-2/file.pdf"),
}));
vi.mock("@/lib/services/storage", () => ({
  uploadFile: mockUploadFile,
  createSignedUrl: mockCreateSignedUrl,
  buildStoragePath: mockBuildStoragePath,
}));

const { mockValidateUpload, mockExtractTextFromUpload, mockMimeTypeForKind } = vi.hoisted(() => ({
  mockValidateUpload: vi.fn(),
  mockExtractTextFromUpload: vi.fn(),
  mockMimeTypeForKind: vi.fn(() => "application/pdf"),
}));
vi.mock("@/lib/services/document-parsing", () => ({
  validateUpload: mockValidateUpload,
  extractTextFromUpload: mockExtractTextFromUpload,
  mimeTypeForKind: mockMimeTypeForKind,
}));

import { requirePermission } from "@/lib/authz";
import { withTenantContext } from "@/lib/db/tenant-context";
import {
  createFakeSql,
  asTransactionSql,
  type FakeQueryHandler,
} from "@/lib/db/test-helpers/fake-sql";
import { makeMembership } from "@/lib/db/test-helpers/service-fixtures";
import {
  approveAndPublish,
  createAuthoredVersion,
  createUploadedVersion,
  getDownloadUrl,
  rejectReview,
  submitForReview,
  updateDraftVersion,
} from "./document-versions";

function wireTenantContext(handlers: FakeQueryHandler[] = []) {
  const fakeSql = createFakeSql(handlers);
  vi.mocked(withTenantContext).mockImplementation(async (_ctx, fn) =>
    fn(asTransactionSql(fakeSql)),
  );
  return fakeSql;
}

const DOCUMENT_ID = "22222222-2222-4222-8222-222222222222";
const VERSION_ID = "33333333-3333-4333-8333-333333333333";

describe("document-versions service", () => {
  beforeEach(() => {
    vi.mocked(requirePermission).mockReset();
    mockUploadFile.mockReset();
    mockCreateSignedUrl.mockReset();
    mockValidateUpload.mockReset();
    mockExtractTextFromUpload.mockReset();
  });

  describe("createAuthoredVersion", () => {
    it("rejects when a draft or in-review version is already in progress", async () => {
      vi.mocked(requirePermission).mockResolvedValue(
        makeMembership({ permissions: ["knowledge.edit"] }),
      );
      wireTenantContext([
        {
          match: (t) => t.includes("select * from knowledge_documents where id"),
          respond: () => [{ id: DOCUMENT_ID, department_id: null }],
        },
        {
          match: (t) => t.includes("select id from document_versions"),
          respond: () => [{ id: "existing-draft" }],
        },
      ]);

      await expect(
        createAuthoredVersion({
          documentId: DOCUMENT_ID,
          title: "Policy v2",
          content: "Updated text",
        }),
      ).rejects.toThrow("already exists for this document");
    });

    it("creates the next version number and records it as authored", async () => {
      vi.mocked(requirePermission).mockResolvedValue(
        makeMembership({ permissions: ["knowledge.edit"] }),
      );
      const fakeSql = wireTenantContext([
        {
          match: (t) => t.includes("select * from knowledge_documents where id"),
          respond: () => [{ id: DOCUMENT_ID, department_id: null }],
        },
        { match: (t) => t.includes("select id from document_versions"), respond: () => [] },
        {
          match: (t) => t.includes("select coalesce(max(version_number)"),
          respond: () => [{ max_version: 1 }],
        },
        {
          match: (t) => t.includes("insert into document_versions"),
          respond: () => [{ id: VERSION_ID, version_number: 2, source: "authored" }],
        },
      ]);

      const version = await createAuthoredVersion({
        documentId: DOCUMENT_ID,
        title: "Policy v2",
        content: "Updated text",
      });

      expect(version.version_number).toBe(2);
      expect(fakeSql.calls.some((c) => c.text.includes("insert into audit_events"))).toBe(true);
    });
  });

  describe("createUploadedVersion", () => {
    it("validates the file, extracts text, uploads to storage, and records the storage path", async () => {
      mockValidateUpload.mockReturnValue("pdf");
      mockExtractTextFromUpload.mockResolvedValue("extracted contents");
      mockUploadFile.mockResolvedValue(undefined);
      vi.mocked(requirePermission).mockResolvedValue(
        makeMembership({ permissions: ["knowledge.edit"] }),
      );
      const fakeSql = wireTenantContext([
        {
          match: (t) => t.includes("select * from knowledge_documents where id"),
          respond: () => [{ id: DOCUMENT_ID, department_id: null }],
        },
        { match: (t) => t.includes("select id from document_versions"), respond: () => [] },
        {
          match: (t) => t.includes("select coalesce(max(version_number)"),
          respond: () => [{ max_version: 0 }],
        },
        {
          match: (t) => t.includes("insert into document_versions"),
          respond: () => [{ id: VERSION_ID, version_number: 1, source: "uploaded" }],
        },
        {
          match: (t) => t.includes("update document_versions set storage_path"),
          respond: () => [
            { id: VERSION_ID, version_number: 1, storage_path: "org-1/doc-1/ver-2/file.pdf" },
          ],
        },
      ]);

      const version = await createUploadedVersion(DOCUMENT_ID, "Handbook", {
        buffer: Buffer.from("pdf bytes"),
        filename: "handbook.pdf",
      });

      expect(mockUploadFile).toHaveBeenCalledWith(
        "org-1/doc-1/ver-2/file.pdf",
        expect.any(Buffer),
        "application/pdf",
      );
      expect(version.storage_path).toBe("org-1/doc-1/ver-2/file.pdf");
      expect(fakeSql.calls.some((c) => c.text.includes("insert into audit_events"))).toBe(true);
    });
  });

  describe("submitForReview", () => {
    it("rejects submitting a version that isn't a draft", async () => {
      vi.mocked(requirePermission).mockResolvedValue(makeMembership());
      wireTenantContext([
        {
          match: (t) => t.includes("select * from document_versions where id"),
          respond: () => [{ id: VERSION_ID, status: "published", department_id: null }],
        },
      ]);

      await expect(submitForReview(VERSION_ID)).rejects.toThrow("Only a draft version");
    });
  });

  describe("rejectReview", () => {
    it("requires knowledge.review and returns the version to draft with notes", async () => {
      vi.mocked(requirePermission)
        .mockResolvedValueOnce(makeMembership())
        .mockResolvedValueOnce(makeMembership({ permissions: ["knowledge.review"] }));
      const fakeSql = wireTenantContext([
        {
          match: (t) => t.includes("select * from document_versions where id"),
          respond: () => [{ id: VERSION_ID, status: "in_review", department_id: null }],
        },
        {
          match: (t) => t.includes("update document_versions set"),
          respond: () => [{ id: VERSION_ID, status: "draft", review_notes: "Needs more detail" }],
        },
      ]);

      const updated = await rejectReview(VERSION_ID, "Needs more detail");

      expect(updated.status).toBe("draft");
      expect(requirePermission).toHaveBeenCalledWith("knowledge.review", {
        scope: { departmentId: undefined },
      });
      expect(fakeSql.calls.some((c) => c.text.includes("insert into audit_events"))).toBe(true);
    });
  });

  describe("approveAndPublish", () => {
    it("rejects publishing a version that isn't in review", async () => {
      vi.mocked(requirePermission).mockResolvedValue(makeMembership());
      wireTenantContext([
        {
          match: (t) => t.includes("select * from document_versions where id"),
          respond: () => [{ id: VERSION_ID, status: "draft", department_id: null }],
        },
      ]);

      await expect(approveAndPublish(VERSION_ID)).rejects.toThrow("Only an in-review version");
    });

    it("supersedes the prior published version and updates the document's current_version_id in one transaction", async () => {
      vi.mocked(requirePermission)
        .mockResolvedValueOnce(makeMembership())
        .mockResolvedValueOnce(makeMembership({ permissions: ["knowledge.publish"] }));
      const fakeSql = wireTenantContext([
        {
          match: (t) => t.includes("select * from document_versions where id"),
          respond: () => [
            { id: VERSION_ID, status: "in_review", document_id: DOCUMENT_ID, department_id: null },
          ],
        },
        {
          match: (t) => t.includes("select * from knowledge_documents where id"),
          respond: () => [{ id: DOCUMENT_ID, current_version_id: "old-version" }],
        },
        {
          match: (t) =>
            t.includes("update document_versions set") && t.includes("status = 'published'"),
          respond: () => [{ id: VERSION_ID, status: "published" }],
        },
        {
          match: (t) => t.includes("update document_versions set status = 'superseded'"),
          respond: () => [],
        },
        {
          match: (t) => t.includes("update knowledge_documents set current_version_id"),
          respond: () => [],
        },
      ]);

      const published = await approveAndPublish(VERSION_ID);

      expect(published.status).toBe("published");
      const supersedeCall = fakeSql.calls.find((c) =>
        c.text.includes("update document_versions set status = 'superseded'"),
      );
      expect(supersedeCall?.values).toContain("old-version");
      const documentUpdateCall = fakeSql.calls.find((c) =>
        c.text.includes("update knowledge_documents set current_version_id"),
      );
      expect(documentUpdateCall?.values).toContain(VERSION_ID);
    });
  });

  describe("getDownloadUrl", () => {
    it("blocks downloading a flagged file", async () => {
      vi.mocked(requirePermission).mockResolvedValue(makeMembership());
      wireTenantContext([
        {
          match: (t) => t.includes("select * from document_versions where id"),
          respond: () => [
            { id: VERSION_ID, storage_path: "path", scan_status: "flagged", department_id: null },
          ],
        },
      ]);

      await expect(getDownloadUrl(VERSION_ID)).rejects.toThrow("flagged");
    });

    it("returns a signed URL for a version with no scan issue", async () => {
      vi.mocked(requirePermission).mockResolvedValue(makeMembership());
      mockCreateSignedUrl.mockResolvedValue("https://signed.example/file");
      wireTenantContext([
        {
          match: (t) => t.includes("select * from document_versions where id"),
          respond: () => [
            {
              id: VERSION_ID,
              storage_path: "org-1/doc-1/ver-1/file.pdf",
              scan_status: "pending_scan",
              department_id: null,
            },
          ],
        },
      ]);

      const url = await getDownloadUrl(VERSION_ID);

      expect(url).toBe("https://signed.example/file");
      expect(mockCreateSignedUrl).toHaveBeenCalledWith("org-1/doc-1/ver-1/file.pdf");
    });
  });

  describe("updateDraftVersion", () => {
    it("rejects editing an uploaded-file version in place", async () => {
      vi.mocked(requirePermission).mockResolvedValue(makeMembership());
      wireTenantContext([
        {
          match: (t) => t.includes("select * from document_versions where id"),
          respond: () => [
            { id: VERSION_ID, status: "draft", source: "uploaded", department_id: null },
          ],
        },
      ]);

      await expect(
        updateDraftVersion(VERSION_ID, { title: "New title", content: "New content" }),
      ).rejects.toThrow("can't be edited in place");
    });
  });
});
