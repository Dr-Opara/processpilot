import "server-only";
import { getAdminSql } from "@/lib/db/client-admin";
import { registerJobHandler } from "@/lib/jobs/registry";
import { expireWaiver } from "@/lib/services/waivers";

/**
 * The one Phase 11 background job — expires a temporary waiver once
 * past its expires_at, unless it was renewed (a renewal re-enqueues its
 * own job against the new expiry) or otherwise already resolved.
 * Registered at module load per evidence-handlers.ts's established
 * pattern — import this module (for its side effect) from
 * src/app/api/jobs/process/route.ts. Runs through the admin client
 * rather than withTenantContext(), same reasoning as every other
 * Phase 8/9/10 job handler.
 */
registerJobHandler("waiver-expiration-check", async ({ job }) => {
  const sql = getAdminSql();
  const { waiverId } = job.payload as { waiverId: string };
  await sql.begin((tx) => expireWaiver(tx, waiverId, job.organization_id));
});
