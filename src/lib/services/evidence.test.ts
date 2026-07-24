import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz", () => ({
  getCurrentMembership: vi.fn(),
  requirePermission: vi.fn(),
}));
vi.mock("@/lib/db/tenant-context", () => ({
  withTenantContext: vi.fn(),
}));
vi.mock("@/lib/services/evidence-storage", () => ({
  buildEvidenceStoragePath: vi.fn(() => "org-1/evidence-1/photo.jpg"),
  uploadEvidenceFile: vi.fn().mockResolvedValue(undefined),
  createEvidenceSignedUrl: vi.fn().mockResolvedValue("https://signed.example/evidence"),
}));
vi.mock("@/lib/jobs/enqueue", () => ({
  enqueueJob: vi.fn().mockResolvedValue({}),
}));

import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { withTenantContext } from "@/lib/db/tenant-context";
import { createEvidenceSignedUrl, uploadEvidenceFile } from "@/lib/services/evidence-storage";
import { enqueueJob } from "@/lib/jobs/enqueue";
import {
  createFakeSql,
  asTransactionSql,
  asSql,
  type FakeQueryHandler,
} from "@/lib/db/test-helpers/fake-sql";
import { makeMembership } from "@/lib/db/test-helpers/service-fixtures";
import {
  expireEvidence,
  getEvidenceDownloadUrl,
  replaceEvidence,
  reviewEvidence,
  uploadEvidence,
} from "./evidence";

function wireTenantContext(handlers: FakeQueryHandler[] = []) {
  const fakeSql = createFakeSql(handlers);
  vi.mocked(withTenantContext).mockImplementation(async (_ctx, fn) =>
    fn(asTransactionSql(fakeSql)),
  );
  return fakeSql;
}

const catchAllEventsAndAudit: FakeQueryHandler[] = [
  { match: (t) => t.includes("insert into evidence_events"), respond: () => [] },
  { match: (t) => t.includes("insert into audit_events"), respond: () => [{ id: "audit-1" }] },
];

function jpeg(): Buffer {
  return Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01, 0x02, 0x03]);
}

const evidenceRow = {
  id: "ev-1",
  organization_id: "org-1",
  department_id: null,
  task_id: "task-1",
  form_submission_id: null,
  status: "pending_review",
  scan_status: "clean",
  uploaded_by: "member-1",
  storage_path: "org-1/ev-1/photo.jpg",
};

describe("evidence service", () => {
  beforeEach(() => {
    vi.mocked(getCurrentMembership).mockReset();
    vi.mocked(requirePermission).mockReset();
    vi.mocked(uploadEvidenceFile).mockClear();
    vi.mocked(enqueueJob).mockClear();
  });

  describe("uploadEvidence", () => {
    it("rejects an upload not attached to a task or a form submission", async () => {
      await expect(uploadEvidence({}, { buffer: jpeg(), filename: "photo.jpg" })).rejects.toThrow();
    });

    it("rejects a file whose bytes don't match any known signature", async () => {
      const preCheck = makeMembership();
      vi.mocked(getCurrentMembership).mockResolvedValue(preCheck);
      wireTenantContext([
        {
          match: (t) => t.includes("select department_id, workflow_id from tasks"),
          respond: () => [{ department_id: null, workflow_id: "wf-1" }],
        },
      ]);

      await expect(
        uploadEvidence(
          { taskId: "task-1" },
          { buffer: Buffer.from("not a real file"), filename: "photo.jpg" },
        ),
      ).rejects.toThrow(/Unsupported file type/);
    });

    it("rejects a file whose bytes match a signature that doesn't match its declared extension", async () => {
      const preCheck = makeMembership();
      vi.mocked(getCurrentMembership).mockResolvedValue(preCheck);
      wireTenantContext([
        {
          match: (t) => t.includes("select department_id, workflow_id from tasks"),
          respond: () => [{ department_id: null, workflow_id: "wf-1" }],
        },
      ]);

      await expect(
        uploadEvidence({ taskId: "task-1" }, { buffer: jpeg(), filename: "photo.png" }),
      ).rejects.toThrow(/contents don't match/);
    });

    it("rejects when the referenced task does not exist in this organization (tenant isolation)", async () => {
      const preCheck = makeMembership();
      vi.mocked(getCurrentMembership).mockResolvedValue(preCheck);
      wireTenantContext([
        {
          match: (t) => t.includes("select department_id, workflow_id from tasks"),
          respond: () => [],
        },
      ]);

      await expect(
        uploadEvidence({ taskId: "someone-elses-task" }, { buffer: jpeg(), filename: "photo.jpg" }),
      ).rejects.toThrow("Task not found");
    });

    it("uploads a valid file, hashes it, and logs the 'uploaded' chain-of-custody event", async () => {
      const preCheck = makeMembership();
      vi.mocked(getCurrentMembership).mockResolvedValue(preCheck);
      const membership = makeMembership({ permissions: ["evidence.upload"] });
      vi.mocked(requirePermission).mockResolvedValue(membership);
      const fakeSql = wireTenantContext([
        {
          match: (t) => t.includes("select department_id, workflow_id from tasks"),
          respond: () => [{ department_id: null, workflow_id: "wf-1" }],
        },
        {
          match: (t) => t.includes("insert into evidence ("),
          respond: () => [{ id: "ev-1", organization_id: "org-1", storage_path: "" }],
        },
        {
          match: (t) => t.includes("update evidence set storage_path"),
          respond: () => [
            { id: "ev-1", organization_id: "org-1", storage_path: "org-1/ev-1/photo.jpg" },
          ],
        },
        ...catchAllEventsAndAudit,
      ]);

      const evidence = await uploadEvidence(
        { taskId: "task-1" },
        { buffer: jpeg(), filename: "photo.jpg" },
      );

      expect(evidence.storage_path).toBe("org-1/ev-1/photo.jpg");
      expect(uploadEvidenceFile).toHaveBeenCalledTimes(1);
      expect(fakeSql.calls.some((c) => c.text.includes("insert into evidence_events"))).toBe(true);
    });

    it("schedules an evidence-expiration-check job when expiresAt is set", async () => {
      const preCheck = makeMembership();
      vi.mocked(getCurrentMembership).mockResolvedValue(preCheck);
      const membership = makeMembership({ permissions: ["evidence.upload"] });
      vi.mocked(requirePermission).mockResolvedValue(membership);
      wireTenantContext([
        {
          match: (t) => t.includes("select department_id, workflow_id from tasks"),
          respond: () => [{ department_id: null, workflow_id: "wf-1" }],
        },
        {
          match: (t) => t.includes("insert into evidence ("),
          respond: () => [{ id: "ev-1", organization_id: "org-1", storage_path: "" }],
        },
        {
          match: (t) => t.includes("update evidence set storage_path"),
          respond: () => [{ id: "ev-1", organization_id: "org-1", storage_path: "x" }],
        },
        ...catchAllEventsAndAudit,
      ]);

      await uploadEvidence(
        { taskId: "task-1", expiresAt: "2026-08-01T00:00:00.000Z" },
        { buffer: jpeg(), filename: "photo.jpg" },
      );

      expect(enqueueJob).toHaveBeenCalledWith(
        expect.anything(),
        "org-1",
        expect.objectContaining({ jobType: "evidence-expiration-check" }),
      );
    });
  });

  describe("reviewEvidence", () => {
    it("rejects reviewing evidence that isn't pending review", async () => {
      const preCheck = makeMembership();
      vi.mocked(getCurrentMembership).mockResolvedValue(preCheck);
      wireTenantContext([
        {
          match: (t) => t.includes("select * from evidence where id"),
          respond: () => [{ ...evidenceRow, status: "accepted" }],
        },
      ]);

      await expect(reviewEvidence("ev-1", { decision: "accepted" })).rejects.toThrow(
        "pending review",
      );
    });

    it("accepts evidence and records the decision", async () => {
      const preCheck = makeMembership();
      vi.mocked(getCurrentMembership).mockResolvedValue(preCheck);
      const membership = makeMembership({ permissions: ["evidence.review"] });
      vi.mocked(requirePermission).mockResolvedValue(membership);
      const fakeSql = wireTenantContext([
        {
          match: (t) => t.includes("select * from evidence where id"),
          respond: () => [evidenceRow],
        },
        {
          match: (t) => t.includes("update evidence set"),
          respond: () => [{ ...evidenceRow, status: "accepted" }],
        },
        ...catchAllEventsAndAudit,
      ]);

      const updated = await reviewEvidence("ev-1", { decision: "accepted", notes: "Looks good" });

      expect(updated.status).toBe("accepted");
      expect(fakeSql.calls.some((c) => c.text.includes("insert into evidence_events"))).toBe(true);
    });
  });

  describe("replaceEvidence", () => {
    it("rejects replacing evidence that is neither rejected nor expired", async () => {
      const preCheck = makeMembership();
      vi.mocked(getCurrentMembership).mockResolvedValue(preCheck);
      wireTenantContext([
        {
          match: (t) => t.includes("select * from evidence where id"),
          respond: () => [evidenceRow],
        },
      ]);

      await expect(
        replaceEvidence("ev-1", { buffer: jpeg(), filename: "photo.jpg" }),
      ).rejects.toThrow("Only rejected or expired evidence");
    });

    it("marks the old evidence 'replaced' and links the new row via replaces_evidence_id", async () => {
      const preCheck = makeMembership();
      vi.mocked(getCurrentMembership).mockResolvedValue(preCheck);
      const membership = makeMembership({ permissions: ["evidence.upload"] });
      vi.mocked(requirePermission).mockResolvedValue(membership);
      wireTenantContext([
        {
          match: (t) => t.includes("select * from evidence where id"),
          respond: () => [{ ...evidenceRow, status: "rejected" }],
        },
        {
          match: (t) => t.includes("select department_id, workflow_id from tasks"),
          respond: () => [{ department_id: null, workflow_id: "wf-1" }],
        },
        {
          match: (t) => t.includes("insert into evidence ("),
          respond: () => [{ id: "ev-2", organization_id: "org-1", storage_path: "" }],
        },
        {
          match: (t) => t.includes("update evidence set storage_path"),
          respond: () => [{ id: "ev-2", organization_id: "org-1", storage_path: "x" }],
        },
        {
          match: (t) => t.includes("update evidence set replaces_evidence_id"),
          respond: () => [{ id: "ev-2", replaces_evidence_id: "ev-1" }],
        },
        {
          match: (t) => t.includes("update evidence set status = 'replaced'"),
          respond: () => [{ ...evidenceRow, id: "ev-1", status: "replaced" }],
        },
        ...catchAllEventsAndAudit,
      ]);

      const replacement = await replaceEvidence("ev-1", { buffer: jpeg(), filename: "photo2.jpg" });

      expect(replacement.replaces_evidence_id).toBe("ev-1");
    });
  });

  describe("expireEvidence", () => {
    it("is a no-op for evidence that is already terminal", async () => {
      const fakeSql = createFakeSql([
        {
          match: (t) => t.includes("select * from evidence where id"),
          respond: () => [{ ...evidenceRow, status: "rejected" }],
        },
      ]);

      await expireEvidence(asSql(fakeSql), "ev-1", "org-1");

      expect(
        fakeSql.calls.some((c) => c.text.includes("update evidence set status = 'expired'")),
      ).toBe(false);
    });

    it("expires accepted evidence past its retention date", async () => {
      const fakeSql = createFakeSql([
        {
          match: (t) => t.includes("select * from evidence where id"),
          respond: () => [{ ...evidenceRow, status: "accepted" }],
        },
        {
          match: (t) => t.includes("update evidence set status = 'expired'"),
          respond: () => [{ ...evidenceRow, status: "expired" }],
        },
        { match: (t) => t.includes("insert into evidence_events"), respond: () => [] },
        {
          match: (t) => t.includes("insert into audit_events"),
          respond: () => [{ id: "audit-1" }],
        },
      ]);

      await expireEvidence(asSql(fakeSql), "ev-1", "org-1");

      expect(
        fakeSql.calls.some((c) => c.text.includes("update evidence set status = 'expired'")),
      ).toBe(true);
    });
  });

  describe("getEvidenceDownloadUrl", () => {
    it("rejects a caller who is neither the uploader nor a reviewer/manager", async () => {
      const preCheck = makeMembership({ member: { id: "someone-else" } });
      vi.mocked(getCurrentMembership).mockResolvedValue(preCheck);
      wireTenantContext([
        {
          match: (t) => t.includes("select * from evidence where id"),
          respond: () => [evidenceRow],
        },
      ]);

      await expect(getEvidenceDownloadUrl("ev-1")).rejects.toThrow("not authorized");
    });

    it("rejects downloading a flagged file even for the uploader", async () => {
      const preCheck = makeMembership({ member: { id: "member-1" } });
      vi.mocked(getCurrentMembership).mockResolvedValue(preCheck);
      wireTenantContext([
        {
          match: (t) => t.includes("select * from evidence where id"),
          respond: () => [{ ...evidenceRow, scan_status: "flagged" }],
        },
      ]);

      await expect(getEvidenceDownloadUrl("ev-1")).rejects.toThrow("flagged");
    });

    it("issues a signed URL and logs a 'downloaded' event for the uploader", async () => {
      const preCheck = makeMembership({ member: { id: "member-1" } });
      vi.mocked(getCurrentMembership).mockResolvedValue(preCheck);
      const fakeSql = wireTenantContext([
        {
          match: (t) => t.includes("select * from evidence where id"),
          respond: () => [evidenceRow],
        },
        ...catchAllEventsAndAudit,
      ]);

      const url = await getEvidenceDownloadUrl("ev-1");

      expect(url).toBe("https://signed.example/evidence");
      expect(createEvidenceSignedUrl).toHaveBeenCalledWith(evidenceRow.storage_path);
      expect(fakeSql.calls.some((c) => c.text.includes("insert into evidence_events"))).toBe(true);
    });
  });
});
