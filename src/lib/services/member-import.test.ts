import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz", () => ({
  requirePermission: vi.fn(),
}));
vi.mock("@/lib/db/tenant-context", () => ({
  withTenantContext: vi.fn(),
}));

const { mockCreateInvitation } = vi.hoisted(() => ({ mockCreateInvitation: vi.fn() }));
vi.mock("@/lib/services/invitations", () => ({
  createInvitation: mockCreateInvitation,
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
import { confirmImport, parseImportRows, previewImport } from "./member-import";

interface Directory {
  roles?: { id: string; key: string; name: string }[];
  locations?: { id: string; name: string }[];
  departments?: { id: string; name: string }[];
  teams?: { id: string; name: string }[];
  existingMembers?: { email: string; id: string }[];
  pendingInvitations?: { email: string }[];
}

function wireDirectory(directory: Directory, extra: FakeQueryHandler[] = []) {
  const handlers: FakeQueryHandler[] = [
    { match: (t) => t.includes("select * from roles"), respond: () => directory.roles ?? [] },
    {
      match: (t) => t.includes("select id, name from organization_locations"),
      respond: () => directory.locations ?? [],
    },
    {
      match: (t) => t.includes("select id, name from departments"),
      respond: () => directory.departments ?? [],
    },
    {
      match: (t) => t.includes("select id, name from teams"),
      respond: () => directory.teams ?? [],
    },
    {
      match: (t) => t.includes("select lower(p.email) as email, om.id from organization_members"),
      respond: () => directory.existingMembers ?? [],
    },
    {
      match: (t) => t.includes("select lower(email) as email from organization_invitations"),
      respond: () => directory.pendingInvitations ?? [],
    },
    ...extra,
  ];
  const fakeSql = createFakeSql(handlers);
  vi.mocked(withTenantContext).mockImplementation(async (_ctx, fn) =>
    fn(asTransactionSql(fakeSql)),
  );
  return fakeSql;
}

const EMPLOYEE_ROLE = { id: "role-employee", key: "employee", name: "Employee" };

function csvOf(
  rows: string[][],
  headers = [
    "First name",
    "Last name",
    "Work email",
    "Job title",
    "Role",
    "Location",
    "Department",
    "Team",
    "Manager email",
    "Start date",
  ],
): string {
  return [headers, ...rows].map((row) => row.join(",")).join("\n");
}

describe("member-import service", () => {
  beforeEach(() => {
    vi.mocked(requirePermission).mockReset();
    mockCreateInvitation.mockReset();
  });

  it("rejects an empty CSV file", () => {
    expect(() => parseImportRows("")).toThrow("empty");
  });

  it("flags rows with missing required fields and an invalid email", async () => {
    vi.mocked(requirePermission).mockResolvedValue(
      makeMembership({ permissions: ["member.invite"] }),
    );
    wireDirectory({ roles: [EMPLOYEE_ROLE] });
    const csv = csvOf([["", "Rivera", "not-an-email", "", "", "", "", "", "", ""]]);

    const preview = await previewImport(csv, csv.length);

    expect(preview.errorCount).toBe(1);
    expect(preview.rows[0].errors).toContain("First name is required.");
    expect(preview.rows[0].errors).toContain("Work email is not a valid email address.");
  });

  it("flags unresolvable role/location/department/team/manager references", async () => {
    vi.mocked(requirePermission).mockResolvedValue(
      makeMembership({ permissions: ["member.invite"] }),
    );
    wireDirectory({ roles: [EMPLOYEE_ROLE] });
    const csv = csvOf([
      [
        "Jordan",
        "Rivera",
        "jordan@example.com",
        "Tech",
        "not-a-role",
        "Nowhere",
        "Nothing",
        "Nobody",
        "missing.manager@example.com",
        "",
      ],
    ]);

    const preview = await previewImport(csv, csv.length);

    expect(preview.rows[0].errors).toEqual([
      'Role "not-a-role" does not exist.',
      'Location "Nowhere" does not exist.',
      'Department "Nothing" does not exist.',
      'Team "Nobody" does not exist.',
      'Manager "missing.manager@example.com" is not an existing member.',
    ]);
  });

  it("detects all three duplicate reasons", async () => {
    vi.mocked(requirePermission).mockResolvedValue(
      makeMembership({ permissions: ["member.invite"] }),
    );
    wireDirectory({
      roles: [EMPLOYEE_ROLE],
      existingMembers: [{ email: "existing@example.com", id: "member-existing" }],
      pendingInvitations: [{ email: "pending@example.com" }],
    });
    const csv = csvOf([
      ["A", "One", "dup@example.com", "", "", "", "", "", "", ""],
      ["B", "Two", "dup@example.com", "", "", "", "", "", "", ""],
      ["C", "Three", "existing@example.com", "", "", "", "", "", "", ""],
      ["D", "Four", "pending@example.com", "", "", "", "", "", "", ""],
    ]);

    const preview = await previewImport(csv, csv.length);

    expect(preview.rows[1].duplicateReason).toBe("in_file");
    expect(preview.rows[2].duplicateReason).toBe("existing_member");
    expect(preview.rows[3].duplicateReason).toBe("pending_invitation");
    expect(preview.duplicateCount).toBe(3);
  });

  it("rejects files over the 2 MB limit before parsing", async () => {
    await expect(previewImport("a,b\n1,2", 3 * 1024 * 1024)).rejects.toThrow("2 MB");
  });

  it("confirmImport creates a batch, invites valid rows, and rolls up a partially_failed status", async () => {
    vi.mocked(requirePermission).mockResolvedValue(
      makeMembership({ permissions: ["member.invite"] }),
    );
    mockCreateInvitation
      .mockResolvedValueOnce({ id: "inv-1" })
      .mockRejectedValueOnce(new AppError("conflict", "boom"));
    const fakeSql = wireDirectory({ roles: [EMPLOYEE_ROLE] }, [
      {
        match: (t) => t.includes("insert into member_import_batches"),
        respond: () => [{ id: "batch-1", status: "processing", total_rows: 2 }],
      },
      { match: (t) => t.includes("insert into member_import_rows"), respond: () => [] },
      { match: (t) => t.includes("update member_import_rows set"), respond: () => [] },
      {
        match: (t) => t.includes("update member_import_batches set"),
        respond: () => [
          {
            id: "batch-1",
            status: "partially_failed",
            succeeded_rows: 1,
            failed_rows: 1,
            duplicate_rows: 0,
          },
        ],
      },
      { match: (t) => t.includes("select * from member_import_rows"), respond: () => [] },
    ]);

    const csv = csvOf([
      ["Jordan", "Rivera", "jordan@example.com", "", "", "", "", "", "", ""],
      ["Sam", "Lee", "sam@example.com", "", "", "", "", "", "", ""],
    ]);

    const outcome = await confirmImport(csv, csv.length, "employees.csv");

    expect(outcome.batch.status).toBe("partially_failed");
    expect(mockCreateInvitation).toHaveBeenCalledTimes(2);
    expect(fakeSql.calls.some((c) => c.text.includes("insert into audit_events"))).toBe(true);
  });
});
