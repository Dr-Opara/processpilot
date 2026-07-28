import "server-only";
import { getAdminSql } from "@/lib/db/client-admin";
import { registerJobHandler } from "@/lib/jobs/registry";
import { expireExternalAccessGrant } from "@/lib/services/external-access";

/**
 * The Phase 19 background job — expires an external_access_grants row
 * once past its expires_at, unless it was already resolved (revoked,
 * completed, or already expired). Registered at module load per every
 * other job handler's established pattern; import this module (for
 * its side effect) from src/app/api/jobs/process/route.ts.
 */
registerJobHandler("external-access-expiration-check", async ({ job }) => {
  const sql = getAdminSql();
  const { grantId } = job.payload as { grantId: string };
  await sql.begin((tx) => expireExternalAccessGrant(tx, grantId, job.organization_id));
});
