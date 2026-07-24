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
  asSql,
  type FakeQueryHandler,
} from "@/lib/db/test-helpers/fake-sql";
import { makeMembership } from "@/lib/db/test-helpers/service-fixtures";
import { AppError } from "@/lib/errors";
import {
  archiveForm,
  createDraftVersion,
  createForm,
  getPublishedFormVersion,
  publishFormVersion,
  restoreForm,
  updateDraftVersion,
} from "./forms";

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

const validDefinition = { fields: [{ key: "notes", label: "Notes", type: "text" as const }] };

describe("forms service", () => {
  beforeEach(() => {
    vi.mocked(getCurrentMembership).mockReset();
    vi.mocked(requirePermission).mockReset();
  });

  describe("createForm", () => {
    it("creates a form shell when the caller holds form.create", async () => {
      const membership = makeMembership({ permissions: ["form.create"] });
      vi.mocked(requirePermission).mockResolvedValue(membership);
      const fakeSql = wireTenantContext([
        {
          match: (t) => t.includes("insert into forms"),
          respond: () => [{ id: "form-1", title: "Incident report" }],
        },
        catchAllAudit,
      ]);

      const form = await createForm({ title: "Incident report" });

      expect(form).toEqual({ id: "form-1", title: "Incident report" });
      expect(requirePermission).toHaveBeenCalledWith("form.create", {
        scope: { departmentId: undefined },
      });
      expect(fakeSql.calls.some((c) => c.text.includes("insert into audit_events"))).toBe(true);
    });

    it("rejects creation when the caller lacks form.create", async () => {
      vi.mocked(requirePermission).mockRejectedValue(
        new AppError("forbidden", "Missing permission: form.create"),
      );
      wireTenantContext();

      await expect(createForm({ title: "Incident report" })).rejects.toThrow("Missing permission");
    });

    it("rejects a blank title before any permission check", async () => {
      await expect(createForm({ title: "   " })).rejects.toThrow("Title is required");
      expect(requirePermission).not.toHaveBeenCalled();
    });
  });

  describe("createDraftVersion", () => {
    it("rejects an invalid definition (e.g. a select field with no options)", async () => {
      const membership = makeMembership({ permissions: ["form.edit"] });
      vi.mocked(requirePermission).mockResolvedValue(membership);
      wireTenantContext([
        {
          match: (t) => t.includes("select * from forms where id"),
          respond: () => [{ id: "form-1", department_id: null }],
        },
      ]);

      await expect(
        createDraftVersion("form-1", {
          title: "v1",
          definition: { fields: [{ key: "choice", label: "Choice", type: "select" }] },
        }),
      ).rejects.toThrow(/at least one option/);
    });

    it("rejects creating a second draft while one is already in progress", async () => {
      const membership = makeMembership({ permissions: ["form.edit"] });
      vi.mocked(requirePermission).mockResolvedValue(membership);
      wireTenantContext([
        {
          match: (t) => t.includes("select * from forms where id"),
          respond: () => [{ id: "form-1", department_id: null }],
        },
        {
          match: (t) => t.includes("select id from form_versions where form_id"),
          respond: () => [{ id: "existing-draft" }],
        },
      ]);

      await expect(
        createDraftVersion("form-1", { title: "v1", definition: validDefinition }),
      ).rejects.toThrow("A draft version already exists");
    });

    it("creates version 1 for a brand-new form", async () => {
      const membership = makeMembership({ permissions: ["form.edit"] });
      vi.mocked(requirePermission).mockResolvedValue(membership);
      const fakeSql = wireTenantContext([
        {
          match: (t) => t.includes("select * from forms where id"),
          respond: () => [{ id: "form-1", department_id: null }],
        },
        {
          match: (t) => t.includes("select id from form_versions where form_id"),
          respond: () => [],
        },
        {
          match: (t) => t.includes("select coalesce(max(version_number)"),
          respond: () => [{ max_version: 0 }],
        },
        {
          match: (t) => t.includes("insert into form_versions"),
          respond: () => [{ id: "fv-1", version_number: 1, status: "draft" }],
        },
        catchAllAudit,
      ]);

      const version = await createDraftVersion("form-1", {
        title: "v1",
        definition: validDefinition,
      });

      expect(version.version_number).toBe(1);
      expect(fakeSql.calls.some((c) => c.text.includes("insert into form_versions"))).toBe(true);
    });
  });

  describe("updateDraftVersion", () => {
    it("rejects editing a version that is not a draft", async () => {
      const membership = makeMembership();
      vi.mocked(getCurrentMembership).mockResolvedValue(membership);
      vi.mocked(requirePermission).mockResolvedValue(membership);
      wireTenantContext([
        {
          match: (t) => t.includes("select * from form_versions where id"),
          respond: () => [{ id: "fv-1", status: "published", department_id: null }],
        },
      ]);

      await expect(
        updateDraftVersion("fv-1", { title: "v1 edited", definition: validDefinition }),
      ).rejects.toThrow("Only a draft version can be edited");
    });
  });

  describe("publishFormVersion", () => {
    it("rejects publishing a version that is not a draft", async () => {
      const membership = makeMembership();
      vi.mocked(requirePermission).mockResolvedValue(membership);
      wireTenantContext([
        {
          match: (t) => t.includes("select * from form_versions where id"),
          respond: () => [{ id: "fv-1", status: "published", department_id: null }],
        },
      ]);

      await expect(publishFormVersion("fv-1")).rejects.toThrow(
        "Only a draft version can be published",
      );
    });

    it("publishes a draft, supersedes the prior published version, and repoints the form's current_version_id", async () => {
      const membership = makeMembership({ permissions: ["form.publish"] });
      vi.mocked(requirePermission).mockResolvedValue(membership);
      const fakeSql = wireTenantContext([
        {
          match: (t) => t.includes("select * from form_versions where id"),
          respond: () => [{ id: "fv-2", form_id: "form-1", status: "draft", department_id: null }],
        },
        {
          match: (t) => t.includes("select * from forms where id"),
          respond: () => [{ id: "form-1", current_version_id: "fv-1", department_id: null }],
        },
        {
          match: (t) => t.includes("update form_versions set status = 'published'"),
          respond: () => [{ id: "fv-2", status: "published" }],
        },
        {
          match: (t) => t.includes("update form_versions set status = 'superseded'"),
          respond: () => [],
        },
        { match: (t) => t.includes("update forms set current_version_id"), respond: () => [] },
        catchAllAudit,
      ]);

      const published = await publishFormVersion("fv-2");

      expect(published.status).toBe("published");
      expect(
        fakeSql.calls.some((c) =>
          c.text.includes("update form_versions set status = 'superseded'"),
        ),
      ).toBe(true);
      expect(
        fakeSql.calls.some((c) => c.text.includes("update forms set current_version_id")),
      ).toBe(true);
    });

    it("publishes a form's first version without attempting to supersede anything", async () => {
      const membership = makeMembership({ permissions: ["form.publish"] });
      vi.mocked(requirePermission).mockResolvedValue(membership);
      const fakeSql = wireTenantContext([
        {
          match: (t) => t.includes("select * from form_versions where id"),
          respond: () => [{ id: "fv-1", form_id: "form-1", status: "draft", department_id: null }],
        },
        {
          match: (t) => t.includes("select * from forms where id"),
          respond: () => [{ id: "form-1", current_version_id: null, department_id: null }],
        },
        {
          match: (t) => t.includes("update form_versions set status = 'published'"),
          respond: () => [{ id: "fv-1", status: "published" }],
        },
        { match: (t) => t.includes("update forms set current_version_id"), respond: () => [] },
        catchAllAudit,
      ]);

      await publishFormVersion("fv-1");

      expect(
        fakeSql.calls.some((c) =>
          c.text.includes("update form_versions set status = 'superseded'"),
        ),
      ).toBe(false);
    });
  });

  describe("archiveForm / restoreForm", () => {
    it("archives a form", async () => {
      const preCheckMembership = makeMembership();
      vi.mocked(getCurrentMembership).mockResolvedValue(preCheckMembership);
      const membership = makeMembership({ permissions: ["form.edit"] });
      vi.mocked(requirePermission).mockResolvedValue(membership);
      wireTenantContext([
        {
          match: (t) => t.includes("select * from forms where id"),
          respond: () => [{ id: "form-1", department_id: null, archived_at: null }],
        },
        {
          match: (t) => t.includes("update forms set archived_at = now()"),
          respond: () => [{ id: "form-1", archived_at: "2026-07-25T00:00:00.000Z" }],
        },
        catchAllAudit,
      ]);

      const form = await archiveForm("form-1");

      expect(form.archived_at).toBeTruthy();
    });

    it("restores an archived form to published status when it has a current version", async () => {
      const preCheckMembership = makeMembership();
      vi.mocked(getCurrentMembership).mockResolvedValue(preCheckMembership);
      const membership = makeMembership({ permissions: ["form.edit"] });
      vi.mocked(requirePermission).mockResolvedValue(membership);
      wireTenantContext([
        {
          match: (t) => t.includes("select * from forms where id"),
          respond: () => [
            {
              id: "form-1",
              department_id: null,
              archived_at: "2026-07-01T00:00:00.000Z",
              current_version_id: "fv-1",
            },
          ],
        },
        {
          match: (t) => t.includes("update forms set archived_at = null"),
          respond: () => [{ id: "form-1", status: "published" }],
        },
        catchAllAudit,
      ]);

      const form = await restoreForm("form-1");

      expect(form.status).toBe("published");
    });

    it("rejects restoring a form that is not archived", async () => {
      const preCheckMembership = makeMembership();
      vi.mocked(getCurrentMembership).mockResolvedValue(preCheckMembership);
      wireTenantContext([
        {
          match: (t) => t.includes("select * from forms where id"),
          respond: () => [{ id: "form-1", department_id: null, archived_at: null }],
        },
      ]);

      await expect(restoreForm("form-1")).rejects.toThrow("not archived");
    });
  });

  describe("getPublishedFormVersion", () => {
    it("returns null when the form has no published version", async () => {
      const fakeSql = createFakeSql([
        { match: (t) => t.includes("select current_version_id from forms"), respond: () => [] },
      ]);

      const version = await getPublishedFormVersion(asSql(fakeSql), "org-1", "form-1");

      expect(version).toBeNull();
    });

    it("returns the current published version", async () => {
      const fakeSql = createFakeSql([
        {
          match: (t) => t.includes("select current_version_id from forms"),
          respond: () => [{ current_version_id: "fv-1" }],
        },
        {
          match: (t) => t.includes("select * from form_versions where id"),
          respond: () => [{ id: "fv-1", status: "published" }],
        },
      ]);

      const version = await getPublishedFormVersion(asSql(fakeSql), "org-1", "form-1");

      expect(version?.id).toBe("fv-1");
    });
  });
});
