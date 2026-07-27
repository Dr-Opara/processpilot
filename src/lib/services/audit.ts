import "server-only";
import type postgres from "postgres";
import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { AppError } from "@/lib/errors";
import { withTenantContext } from "@/lib/db/tenant-context";
import { recordAuditEvent } from "@/lib/db/audit";
import { AuditAction, AuditResourceType } from "@/lib/db/audit-actions";
import { writeCsv } from "@/lib/services/csv";
import { memberDisplayName } from "@/lib/services/member-display";
import type { AuditEventRow } from "@/lib/db/database.types";

/**
 * Read/export surface over audit_events (src/lib/db/audit.ts's
 * recordAuditEvent(), written from every phase's mutating service
 * actions). Per docs/architecture/audit-and-compliance.md: audit_events
 * is append-only, so this module is deliberately read/export only — no
 * update or delete path exists here, mirroring there being none at the
 * database layer.
 *
 * Row visibility for list/get is left to audit_events_select's RLS
 * policy (has_scoped_permission('audit.view', department_id, null,
 * null)) rather than re-implemented here — the same "getCurrentMembership()
 * plus RLS does the filtering" posture Phase 11's listExceptions() and
 * listCapaPlans() already established, so an org_owner/admin's unscoped
 * grant sees every event and a scoped manager/auditor sees only events
 * tagged with a department they own, with no separate application-layer
 * branch needed for each case.
 */

function toTenantContext(membership: {
  organization: { id: string };
  member: { id: string };
  profile: { clerk_user_id: string };
}) {
  return {
    organizationId: membership.organization.id,
    memberId: membership.member.id,
    clerkUserId: membership.profile.clerk_user_id,
  };
}

export interface AuditEventFilters {
  action?: string;
  resourceType?: string;
  departmentId?: string;
  actorProfileId?: string;
  /** Inclusive, ISO 8601. */
  dateFrom?: string;
  /** Inclusive, ISO 8601. */
  dateTo?: string;
}

export interface AuditEventListItem extends AuditEventRow {
  actorName: string | null;
}

const MAX_PAGE_SIZE = 100;
/** Hard cap on a single export — no streaming/background-job export exists yet for larger histories, see known gaps. */
const MAX_EXPORT_ROWS = 5000;

async function queryAuditEvents(
  tx: postgres.TransactionSql,
  organizationId: string,
  filters: AuditEventFilters,
  limit: number,
  offset: number,
): Promise<AuditEventListItem[]> {
  const rows = await tx<
    (AuditEventRow & {
      actor_first_name: string | null;
      actor_last_name: string | null;
      actor_email: string | null;
    })[]
  >`
    select e.*, p.first_name as actor_first_name, p.last_name as actor_last_name, p.email as actor_email
    from audit_events e
    left join profiles p on p.id = e.actor_profile_id
    where e.organization_id = ${organizationId}
      and (${filters.action ?? null}::text is null or e.action = ${filters.action ?? null})
      and (${filters.resourceType ?? null}::text is null or e.resource_type = ${filters.resourceType ?? null})
      and (${filters.departmentId ?? null}::uuid is null or e.department_id = ${filters.departmentId ?? null})
      and (${filters.actorProfileId ?? null}::uuid is null or e.actor_profile_id = ${filters.actorProfileId ?? null})
      and (${filters.dateFrom ?? null}::timestamptz is null or e.created_at >= ${filters.dateFrom ?? null})
      and (${filters.dateTo ?? null}::timestamptz is null or e.created_at <= ${filters.dateTo ?? null})
    order by e.created_at desc
    limit ${limit} offset ${offset}
  `;
  return rows.map(({ actor_first_name, actor_last_name, actor_email, ...event }) => ({
    ...event,
    actorName: actor_email
      ? memberDisplayName({
          first_name: actor_first_name,
          last_name: actor_last_name,
          email: actor_email,
        })
      : null,
  }));
}

export interface ListAuditEventsResult {
  events: AuditEventListItem[];
  /** true if there is at least one more page beyond the one returned — a plain has-more flag, not an exact total, since counting the full match set is a second, separate query this list doesn't need to pay for. */
  hasMore: boolean;
}

export async function listAuditEvents(
  filters: AuditEventFilters = {},
  pagination: { limit?: number; offset?: number } = {},
): Promise<ListAuditEventsResult> {
  const limit = Math.min(Math.max(pagination.limit ?? 50, 1), MAX_PAGE_SIZE);
  const offset = Math.max(pagination.offset ?? 0, 0);
  const membership = await getCurrentMembership();

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const events = await queryAuditEvents(
      tx,
      membership.organization.id,
      filters,
      limit + 1,
      offset,
    );
    return { events: events.slice(0, limit), hasMore: events.length > limit };
  });
}

export async function exportAuditEvents(filters: AuditEventFilters = {}): Promise<string> {
  const membership = await requirePermission("audit.export", {
    scope: { departmentId: filters.departmentId },
  });

  return withTenantContext(toTenantContext(membership), async (tx) => {
    const events = await queryAuditEvents(
      tx,
      membership.organization.id,
      filters,
      MAX_EXPORT_ROWS,
      0,
    );
    if (events.length === MAX_EXPORT_ROWS) {
      throw new AppError(
        "conflict",
        `This export would exceed the ${MAX_EXPORT_ROWS}-row limit — narrow the date range or filters and try again.`,
      );
    }

    await recordAuditEvent(tx, {
      organizationId: membership.organization.id,
      actorProfileId: membership.profile.id,
      action: AuditAction.AuditEventsExported,
      resourceType: AuditResourceType.AuditExport,
      departmentId: filters.departmentId ?? null,
      source: "app",
      metadata: {
        rowCount: events.length,
        filters: {
          action: filters.action ?? null,
          resourceType: filters.resourceType ?? null,
          departmentId: filters.departmentId ?? null,
          actorProfileId: filters.actorProfileId ?? null,
          dateFrom: filters.dateFrom ?? null,
          dateTo: filters.dateTo ?? null,
        },
      },
    });

    const headers = [
      "Timestamp",
      "Action",
      "Resource type",
      "Resource ID",
      "Actor",
      "Source",
      "Reason",
      "Correlation ID",
    ];
    const csvRows = events.map((event) => [
      event.created_at,
      event.action,
      event.resource_type,
      event.resource_id ?? "",
      event.actorName ?? "",
      event.source,
      event.reason ?? "",
      event.correlation_id ?? "",
    ]);
    return writeCsv(headers, csvRows);
  });
}
