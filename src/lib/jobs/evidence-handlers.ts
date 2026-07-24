import "server-only";
import { getAdminSql } from "@/lib/db/client-admin";
import { registerJobHandler } from "@/lib/jobs/registry";
import { expireEvidence } from "@/lib/services/evidence";

/**
 * The one Phase 9 background job, registered at module load per
 * src/lib/jobs/workflow-handlers.ts's established pattern — import this
 * module (for its side effect) from
 * src/app/api/jobs/process/route.ts. Runs through the admin client
 * rather than withTenantContext() for the same reason workflow-handlers.ts
 * does: a cron tick has no Clerk user session to build tenant claims
 * from.
 */
registerJobHandler("evidence-expiration-check", async ({ job }) => {
  const sql = getAdminSql();
  const { evidenceId } = job.payload as { evidenceId: string };
  await sql.begin((tx) => expireEvidence(tx, evidenceId, job.organization_id));
});
