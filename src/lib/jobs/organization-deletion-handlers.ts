import "server-only";
import { getAdminSql } from "@/lib/db/client-admin";
import { registerJobHandler } from "@/lib/jobs/registry";
import { isOrganizationDeletionEnabled } from "@/lib/services/organization-deletion";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import type { OrganizationDeletionRequestRow } from "@/lib/db/database.types";

/**
 * The Phase 21 background job — finalizes a still-pending
 * organization_deletion_requests row once its grace period has elapsed.
 * Gated by ORGANIZATION_DELETION_ENABLED: with the flag unset (every
 * environment this was built in), the job records that it ran and
 * skipped, exactly like Phase 16's deliver-notification-email job does
 * when no real email provider is configured, rather than either
 * throwing (which would retry forever) or silently deleting data with
 * no real security review of the cascade behind this action. Cancelling
 * the request (status != 'pending') makes this a no-op even when the
 * flag is enabled — same "check status before acting" idempotency
 * pattern as every other self-scheduling job in this codebase.
 */
registerJobHandler("organization-deletion-sweep", async ({ job }) => {
  const sql = getAdminSql();
  const { requestId } = job.payload as { requestId: string };

  const [request] = await sql<OrganizationDeletionRequestRow[]>`
    select * from organization_deletion_requests where id = ${requestId} and organization_id = ${job.organization_id}
  `;
  if (!request || request.status !== "pending") return;

  if (!isOrganizationDeletionEnabled()) {
    await sql.begin((tx) =>
      recordAuditEvent(tx, {
        organizationId: job.organization_id,
        actorProfileId: null,
        action: AuditAction.OrganizationDeletionCompleted,
        resourceType: AuditResourceType.OrganizationDeletionRequest,
        resourceId: requestId,
        source: "system",
        metadata: {
          skipped: true,
          reason: "ORGANIZATION_DELETION_ENABLED is not set in this environment.",
        },
      }),
    );
    return;
  }

  // Real finalization is intentionally not implemented in this pass —
  // enabling it requires the dedicated security review this phase's
  // task brief calls for before any environment sets the flag. See
  // docs/architecture/organization-administration.md's known gaps.
  throw new Error(
    "ORGANIZATION_DELETION_ENABLED is set, but no finalization implementation exists yet — " +
      "requires a dedicated security review before this can safely delete tenant data.",
  );
});
