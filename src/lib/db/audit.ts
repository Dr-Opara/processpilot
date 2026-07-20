import "server-only";
import type postgres from "postgres";
import type { AuditEventRow, AuditEventSource } from "./database.types";

export interface RecordAuditEventInput {
  organizationId: string;
  actorProfileId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  correlationId?: string | null;
  source: AuditEventSource;
  reason?: string | null;
  /** Never include secrets, tokens, or raw document content — see audit_events' migration comment. */
  metadata?: Record<string, postgres.JSONValue>;
}

/**
 * Writes one append-only audit_events row. Takes the sql/transaction
 * handle as a parameter (rather than opening its own connection) so
 * callers can run it inside the same transaction as the action it's
 * recording — either an admin-client transaction (webhook identity sync)
 * or a withTenantContext() transaction (later phases' user-initiated
 * mutations) — so the audit row commits or rolls back atomically with
 * that action.
 */
export async function recordAuditEvent(
  sql: postgres.Sql | postgres.TransactionSql,
  input: RecordAuditEventInput,
): Promise<AuditEventRow> {
  const [event] = await sql<AuditEventRow[]>`
    insert into audit_events (
      organization_id, actor_profile_id, action, resource_type, resource_id,
      correlation_id, source, reason, metadata
    ) values (
      ${input.organizationId}, ${input.actorProfileId ?? null}, ${input.action}, ${input.resourceType},
      ${input.resourceId ?? null}, ${input.correlationId ?? null}, ${input.source},
      ${input.reason ?? null}, ${sql.json(input.metadata ?? {})}
    )
    returning *
  `;
  return event;
}
