import "server-only";
import { getAdminSql } from "@/lib/db/client-admin";
import { isAiConfigured } from "@/lib/ai/availability";
import { isEmailConfigured } from "@/lib/notifications/availability";
import { isBillingConfigured } from "@/lib/billing/availability";
import { isEncryptionConfigured } from "@/lib/crypto/secret-box";
import { isSlackConfigured } from "@/lib/integrations/providers/slack-provider";
import { isErrorReportingConfigured } from "@/lib/observability/error-reporting";
import { isOrganizationDeletionEnabled } from "@/lib/services/organization-deletion";

/**
 * Health/readiness checks (Phase 23). Deliberately returns only
 * booleans/counts/durations — never a connection string, stack trace,
 * or any value derived from tenant data. See
 * docs/architecture/observability.md's "Health and readiness"
 * section for the full contract these two endpoints implement.
 */

export interface DependencyStatus {
  name: string;
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
}

const DB_CHECK_TIMEOUT_MS = 3_000;

async function checkDatabase(): Promise<DependencyStatus> {
  try {
    const sql = getAdminSql();
    await Promise.race([
      sql`select 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), DB_CHECK_TIMEOUT_MS),
      ),
    ]);
    return { name: "database", status: "ok" };
  } catch {
    return { name: "database", status: "unavailable" };
  }
}

export interface QueueHealth {
  pendingCount: number;
  oldestPendingAgeSeconds: number | null;
  deadLetterCountLast24h: number;
  processingCount: number;
}

/** No live database in this environment to query against — see readiness()'s caller for how a database failure is handled without this function ever needing to. */
export async function getQueueHealth(): Promise<QueueHealth> {
  const sql = getAdminSql();

  const [pending] = await sql<{ count: string; oldest: string | null }[]>`
    select count(*) as count, min(scheduled_at)::text as oldest
    from background_jobs
    where status = 'pending' and scheduled_at <= now()
  `;
  const [processing] = await sql<{ count: string }[]>`
    select count(*) as count from background_jobs where status = 'processing'
  `;
  const [deadLetter] = await sql<{ count: string }[]>`
    select count(*) as count from background_jobs
    where status = 'dead_letter' and updated_at > now() - interval '24 hours'
  `;

  const oldest = pending?.oldest ? new Date(pending.oldest) : null;
  return {
    pendingCount: Number(pending?.count ?? 0),
    oldestPendingAgeSeconds: oldest ? Math.floor((Date.now() - oldest.getTime()) / 1000) : null,
    deadLetterCountLast24h: Number(deadLetter?.count ?? 0),
    processingCount: Number(processing?.count ?? 0),
  };
}

export function getProviderConfigurationStatus(): DependencyStatus[] {
  const entries: [string, boolean][] = [
    ["ai", isAiConfigured()],
    ["email", isEmailConfigured()],
    ["billing", isBillingConfigured()],
    ["integration_encryption", isEncryptionConfigured()],
    ["slack_integration", isSlackConfigured()],
    ["error_reporting", isErrorReportingConfigured()],
  ];
  return entries.map(([name, configured]) => ({
    name,
    status: configured ? "ok" : "not_configured",
  }));
}

export interface ReadinessResult {
  status: "ok" | "degraded" | "unavailable";
  database: DependencyStatus;
  queue: QueueHealth | null;
  providers: DependencyStatus[];
  organizationDeletionSweepEnabled: boolean;
}

/**
 * Readiness = "can this instance safely serve traffic." Database
 * unavailability is the only thing that flips overall status to
 * `unavailable` — an unconfigured optional provider (AI/email/billing/
 * Slack/error-reporting) is `degraded` at worst, since this app is
 * documented throughout as functioning with those absent (fails safe,
 * not fake-success, per every provider adapter's own doc).
 */
export async function checkReadiness(): Promise<ReadinessResult> {
  const database = await checkDatabase();
  const providers = getProviderConfigurationStatus();

  let queue: QueueHealth | null = null;
  if (database.status === "ok") {
    try {
      queue = await getQueueHealth();
    } catch {
      queue = null;
    }
  }

  const status: ReadinessResult["status"] =
    database.status !== "ok" ? "unavailable" : queue === null ? "degraded" : "ok";

  return {
    status,
    database,
    queue,
    providers,
    organizationDeletionSweepEnabled: isOrganizationDeletionEnabled(),
  };
}
