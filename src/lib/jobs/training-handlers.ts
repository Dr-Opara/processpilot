import "server-only";
import { getAdminSql } from "@/lib/db/client-admin";
import { registerJobHandler } from "@/lib/jobs/registry";
import { markAssignmentOverdue } from "@/lib/services/training-assignments";
import { expireCertification } from "@/lib/services/certifications";

/**
 * The two Phase 12 background jobs, registered at module load per
 * evidence-handlers.ts's established pattern — import this module (for
 * its side effect) from src/app/api/jobs/process/route.ts. Both run
 * through the admin client rather than withTenantContext(), same
 * reasoning as every other Phase 8/9/10/11 job handler.
 */

registerJobHandler("training-assignment-overdue-check", async ({ job }) => {
  const sql = getAdminSql();
  const { assignmentId } = job.payload as { assignmentId: string };
  await sql.begin((tx) => markAssignmentOverdue(tx, assignmentId, job.organization_id));
});

registerJobHandler("certification-expiry-check", async ({ job }) => {
  const sql = getAdminSql();
  const { certificationId } = job.payload as { certificationId: string };
  await sql.begin((tx) => expireCertification(tx, certificationId, job.organization_id));
});
