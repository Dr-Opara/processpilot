import "server-only";
import { requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import { createInvitation } from "@/lib/services/invitations";
import { parseCsv, writeCsv } from "@/lib/services/csv";
import type {
  MemberImportBatchRow,
  MemberImportRowRow,
  RoleRow,
} from "@/lib/db/database.types";
import type { CurrentMembership } from "@/lib/authz";

export const IMPORT_TEMPLATE_HEADERS = [
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
] as const;

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 1000;
const BATCH_CHUNK_SIZE = 25;

export function getImportTemplate(): string {
  return writeCsv([...IMPORT_TEMPLATE_HEADERS], [
    ["Jordan", "Rivera", "jordan.rivera@example.com", "Maintenance Technician", "employee", "", "", "", "", ""],
  ]);
}

export interface NormalizedImportRow {
  rowNumber: number;
  raw: Record<string, string>;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string | null;
  roleKey: string | null;
  locationName: string | null;
  departmentName: string | null;
  teamName: string | null;
  managerEmail: string | null;
  startDate: string | null;
  errors: string[];
  duplicateReason: "in_file" | "existing_member" | "pending_invitation" | null;
  resolvedRoleId: string | null;
  resolvedLocationId: string | null;
  resolvedDepartmentId: string | null;
  resolvedTeamId: string | null;
  resolvedManagerId: string | null;
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
}

type ImportField =
  | "firstName"
  | "lastName"
  | "email"
  | "jobTitle"
  | "roleKey"
  | "locationName"
  | "departmentName"
  | "teamName"
  | "managerEmail"
  | "startDate";

const HEADER_ALIASES: Record<string, ImportField> = {
  "first name": "firstName",
  "last name": "lastName",
  "work email": "email",
  email: "email",
  "job title": "jobTitle",
  role: "roleKey",
  location: "locationName",
  department: "departmentName",
  team: "teamName",
  "manager email": "managerEmail",
  "start date": "startDate",
};

function toTenantContext(membership: CurrentMembership) {
  return {
    organizationId: membership.organization.id,
    memberId: membership.member.id,
    clerkUserId: membership.profile.clerk_user_id,
  };
}

export function parseImportRows(csvText: string): {
  headers: string[];
  rows: Record<string, string>[];
} {
  const table = parseCsv(csvText);
  if (table.length === 0) {
    throw new AppError("conflict", "The CSV file is empty.");
  }
  const headers = table[0].map((h) => h.trim());
  const dataRows = table.slice(1);
  if (dataRows.length > MAX_ROWS) {
    throw new AppError("conflict", `CSV files are limited to ${MAX_ROWS} rows.`);
  }

  const rows = dataRows
    .filter((row) => row.some((cell) => cell.trim() !== ""))
    .map((row) => {
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        record[header] = (row[index] ?? "").trim();
      });
      return record;
    });

  return { headers, rows };
}

function pickField(raw: Record<string, string>, field: ImportField): string {
  for (const [header, value] of Object.entries(raw)) {
    if (HEADER_ALIASES[normalizeHeader(header)] === field) return value.trim();
  }
  return "";
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Server-revalidates every row against the live database — never trusts a
 * client-supplied "preview looked fine" claim. Used by both the preview
 * step (read-only) and confirmImport() (which re-runs this immediately
 * before writing anything), so a row can never be imported on the
 * strength of a stale preview.
 */
async function validateRows(
  membership: CurrentMembership,
  rawRows: Record<string, string>[],
): Promise<NormalizedImportRow[]> {
  return withTenantContext(toTenantContext(membership), async (tx) => {
    const roles = await tx<RoleRow[]>`
      select * from roles where organization_id is null or organization_id = ${membership.organization.id}
    `;
    const roleByKey = new Map(roles.map((r) => [r.key.toLowerCase(), r]));
    const roleByName = new Map(roles.map((r) => [r.name.toLowerCase(), r]));

    const locations = await tx<{ id: string; name: string }[]>`
      select id, name from organization_locations where organization_id = ${membership.organization.id} and archived_at is null
    `;
    const departments = await tx<{ id: string; name: string }[]>`
      select id, name from departments where organization_id = ${membership.organization.id} and archived_at is null
    `;
    const teams = await tx<{ id: string; name: string }[]>`
      select id, name from teams where organization_id = ${membership.organization.id} and archived_at is null
    `;
    const locationByName = new Map(locations.map((l) => [l.name.toLowerCase(), l.id]));
    const departmentByName = new Map(departments.map((d) => [d.name.toLowerCase(), d.id]));
    const teamByName = new Map(teams.map((t) => [t.name.toLowerCase(), t.id]));

    const existingMembers = await tx<{ email: string; id: string }[]>`
      select lower(p.email) as email, om.id from organization_members om
      join profiles p on p.id = om.profile_id
      where om.organization_id = ${membership.organization.id} and om.status <> 'removed'
    `;
    const memberByEmail = new Map(existingMembers.map((m) => [m.email, m.id]));

    const pendingInvitations = await tx<{ email: string }[]>`
      select lower(email) as email from organization_invitations
      where organization_id = ${membership.organization.id} and status = 'pending'
    `;
    const pendingEmails = new Set(pendingInvitations.map((i) => i.email));

    const seenInFile = new Set<string>();
    const results: NormalizedImportRow[] = [];

    rawRows.forEach((raw, index) => {
      const rowNumber = index + 2; // +1 for header row, +1 for 1-indexing
      const firstName = pickField(raw, "firstName");
      const lastName = pickField(raw, "lastName");
      const email = pickField(raw, "email").toLowerCase();
      const jobTitle = pickField(raw, "jobTitle") || null;
      const roleText = pickField(raw, "roleKey") || null;
      const locationName = pickField(raw, "locationName") || null;
      const departmentName = pickField(raw, "departmentName") || null;
      const teamName = pickField(raw, "teamName") || null;
      const managerEmail = pickField(raw, "managerEmail").toLowerCase() || null;
      const startDate = pickField(raw, "startDate") || null;

      const errors: string[] = [];
      if (!firstName) errors.push("First name is required.");
      if (!lastName) errors.push("Last name is required.");
      if (!email) errors.push("Work email is required.");
      else if (!EMAIL_PATTERN.test(email)) errors.push("Work email is not a valid email address.");

      const resolvedRole = roleText
        ? (roleByKey.get(roleText.toLowerCase()) ?? roleByName.get(roleText.toLowerCase()))
        : roleByKey.get("employee");
      if (roleText && !resolvedRole) errors.push(`Role "${roleText}" does not exist.`);

      const resolvedLocationId = locationName ? (locationByName.get(locationName.toLowerCase()) ?? null) : null;
      if (locationName && !resolvedLocationId) errors.push(`Location "${locationName}" does not exist.`);

      const resolvedDepartmentId = departmentName
        ? (departmentByName.get(departmentName.toLowerCase()) ?? null)
        : null;
      if (departmentName && !resolvedDepartmentId) errors.push(`Department "${departmentName}" does not exist.`);

      const resolvedTeamId = teamName ? (teamByName.get(teamName.toLowerCase()) ?? null) : null;
      if (teamName && !resolvedTeamId) errors.push(`Team "${teamName}" does not exist.`);

      const resolvedManagerId = managerEmail ? (memberByEmail.get(managerEmail) ?? null) : null;
      if (managerEmail && !resolvedManagerId) errors.push(`Manager "${managerEmail}" is not an existing member.`);

      if (startDate && Number.isNaN(Date.parse(startDate))) {
        errors.push("Start date is not a valid date.");
      }

      let duplicateReason: NormalizedImportRow["duplicateReason"] = null;
      if (email) {
        if (seenInFile.has(email)) duplicateReason = "in_file";
        else if (memberByEmail.has(email)) duplicateReason = "existing_member";
        else if (pendingEmails.has(email)) duplicateReason = "pending_invitation";
        seenInFile.add(email);
      }

      results.push({
        rowNumber,
        raw,
        firstName,
        lastName,
        email,
        jobTitle,
        roleKey: resolvedRole?.key ?? null,
        locationName,
        departmentName,
        teamName,
        managerEmail,
        startDate,
        errors,
        duplicateReason,
        resolvedRoleId: resolvedRole?.id ?? null,
        resolvedLocationId,
        resolvedDepartmentId,
        resolvedTeamId,
        resolvedManagerId,
      });
    });

    return results;
  });
}

export interface ImportPreview {
  rows: NormalizedImportRow[];
  validCount: number;
  errorCount: number;
  duplicateCount: number;
}

export async function previewImport(
  csvText: string,
  fileSizeBytes: number,
): Promise<ImportPreview> {
  if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new AppError("conflict", "CSV files are limited to 2 MB.");
  }
  const membership = await requirePermission("member.invite");
  const { rows: rawRows } = parseImportRows(csvText);
  const rows = await validateRows(membership, rawRows);

  return {
    rows,
    validCount: rows.filter((r) => r.errors.length === 0 && !r.duplicateReason).length,
    errorCount: rows.filter((r) => r.errors.length > 0).length,
    duplicateCount: rows.filter((r) => r.duplicateReason !== null).length,
  };
}

export interface ImportOutcome {
  batch: MemberImportBatchRow;
  rows: MemberImportRowRow[];
}

export async function confirmImport(
  csvText: string,
  fileSizeBytes: number,
  originalFilename: string,
): Promise<ImportOutcome> {
  if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new AppError("conflict", "CSV files are limited to 2 MB.");
  }
  const membership = await requirePermission("member.invite");
  const { rows: rawRows } = parseImportRows(csvText);
  const normalized = await validateRows(membership, rawRows);

  const batch = await withTenantContext(toTenantContext(membership), async (tx) => {
    const [created] = await tx<MemberImportBatchRow[]>`
      insert into member_import_batches (organization_id, status, total_rows, original_filename, created_by)
      values (${membership.organization.id}, 'processing', ${normalized.length}, ${originalFilename}, ${membership.profile.id})
      returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.ImportStarted,
      resourceType: AuditResourceType.ImportBatch,
      resourceId: created.id,
      source: "app",
      metadata: { totalRows: normalized.length },
    });

    for (const row of normalized) {
      await tx`
        insert into member_import_rows (organization_id, batch_id, row_number, raw_data, status)
        values (${membership.organization.id}, ${created.id}, ${row.rowNumber}, ${tx.json(row.raw)}, 'pending')
      `;
    }

    return created;
  });

  let succeeded = 0;
  let failed = 0;
  let duplicates = 0;

  // Chunked, sequential processing — each valid row calls Clerk's
  // invitation API (invitations.ts), so this deliberately doesn't fire
  // all rows concurrently against a third-party API.
  for (let start = 0; start < normalized.length; start += BATCH_CHUNK_SIZE) {
    const chunk = normalized.slice(start, start + BATCH_CHUNK_SIZE);
    for (const row of chunk) {
      if (row.errors.length > 0) {
        failed++;
        await recordRowResult(membership, batch.id, row.rowNumber, "failed", row.errors.join(" "));
        continue;
      }
      if (row.duplicateReason) {
        duplicates++;
        await recordRowResult(
          membership,
          batch.id,
          row.rowNumber,
          "duplicate_skipped",
          duplicateMessage(row.duplicateReason),
        );
        continue;
      }

      try {
        const invitation = await createInvitation({
          email: row.email,
          roleId: row.resolvedRoleId as string,
          locationId: row.resolvedLocationId,
          departmentId: row.resolvedDepartmentId,
          teamId: row.resolvedTeamId,
        });
        succeeded++;
        await recordRowResult(membership, batch.id, row.rowNumber, "succeeded", null, invitation.id);
      } catch (error) {
        failed++;
        await recordRowResult(
          membership,
          batch.id,
          row.rowNumber,
          "failed",
          error instanceof AppError ? error.message : "Could not create this invitation.",
        );
      }
    }
  }

  const finalStatus = failed === 0 ? "completed" : succeeded > 0 ? "partially_failed" : "failed";

  const finalBatch = await withTenantContext(toTenantContext(membership), async (tx) => {
    const [updated] = await tx<MemberImportBatchRow[]>`
      update member_import_batches set
        status = ${finalStatus},
        succeeded_rows = ${succeeded},
        failed_rows = ${failed},
        duplicate_rows = ${duplicates},
        completed_at = now()
      where id = ${batch.id}
      returning *
    `;

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: finalStatus === "completed" ? AuditAction.ImportCompleted : AuditAction.ImportPartiallyFailed,
      resourceType: AuditResourceType.ImportBatch,
      resourceId: batch.id,
      source: "app",
      metadata: { succeeded, failed, duplicates },
    });

    const rows = await tx<MemberImportRowRow[]>`
      select * from member_import_rows where batch_id = ${batch.id} order by row_number asc
    `;

    return { batch: updated, rows };
  });

  return finalBatch;
}

function duplicateMessage(reason: NonNullable<NormalizedImportRow["duplicateReason"]>): string {
  switch (reason) {
    case "in_file":
      return "Duplicate email within this file.";
    case "existing_member":
      return "This person is already a member.";
    case "pending_invitation":
      return "An active invitation already exists for this email.";
  }
}

async function recordRowResult(
  membership: CurrentMembership,
  batchId: string,
  rowNumber: number,
  status: "succeeded" | "failed" | "duplicate_skipped",
  errorMessage: string | null,
  invitationId?: string,
): Promise<void> {
  await withTenantContext(toTenantContext(membership), async (tx) => {
    await tx`
      update member_import_rows set
        status = ${status},
        error_message = ${errorMessage},
        invitation_id = ${invitationId ?? null}
      where batch_id = ${batchId} and row_number = ${rowNumber}
    `;
  });
}

export async function getImportBatch(batchId: string): Promise<ImportOutcome> {
  const membership = await requirePermission("member.invite");
  return withTenantContext(toTenantContext(membership), async (tx) => {
    const [batch] = await tx<MemberImportBatchRow[]>`
      select * from member_import_batches where id = ${batchId} and organization_id = ${membership.organization.id}
    `;
    if (!batch) throw new AppError("not_found", "Import batch not found.");
    const rows = await tx<MemberImportRowRow[]>`
      select * from member_import_rows where batch_id = ${batchId} order by row_number asc
    `;
    return { batch, rows };
  });
}

export async function listImportHistory(): Promise<MemberImportBatchRow[]> {
  const membership = await requirePermission("member.invite");
  return withTenantContext(toTenantContext(membership), async (tx) => {
    return tx<MemberImportBatchRow[]>`
      select * from member_import_batches where organization_id = ${membership.organization.id}
      order by created_at desc
    `;
  });
}

export async function generateErrorReport(batchId: string): Promise<string> {
  const { rows } = await getImportBatch(batchId);
  const failedRows = rows.filter((r) => r.status === "failed");
  const headers = [...IMPORT_TEMPLATE_HEADERS, "Error"];
  const csvRows = failedRows.map((row) => {
    const raw = row.raw_data as Record<string, string>;
    return [...IMPORT_TEMPLATE_HEADERS.map((h) => raw[h] ?? ""), row.error_message ?? ""];
  });
  return writeCsv(headers, csvRows);
}
