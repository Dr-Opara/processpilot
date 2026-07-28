import "server-only";
import { withTenantContext } from "@/lib/db/tenant-context";
import type { TenantContext } from "@/lib/db/tenant-context";
import type { ProcessRow, WorkflowRow, WorkflowStatus } from "@/lib/db/database.types";

/**
 * Read functions backing /api/v1/* — take an already-resolved
 * TenantContext (src/lib/api/tenant-context.ts) rather than calling
 * getCurrentMembership()/requirePermission() themselves, since a
 * public-API request has no Clerk session to read. Authorization for
 * these endpoints is the API key's scope (checked in
 * src/lib/api/authenticate.ts before either of these is ever called);
 * RLS still applies underneath using the resolved tenant context's
 * member id, exactly as it does for a session-based request.
 */
export interface PagedResult<T> {
  data: T[];
  hasMore: boolean;
}

export interface ListProcessesApiFilters {
  status?: string;
  q?: string;
}

export async function listProcessesForApi(
  context: TenantContext,
  filters: ListProcessesApiFilters,
  limit: number,
  offset: number,
): Promise<PagedResult<ProcessRow>> {
  return withTenantContext(context, async (tx) => {
    const rows = await tx<ProcessRow[]>`
      select * from processes
      where organization_id = ${context.organizationId}
        and (${filters.status ?? null}::text is null or status = ${filters.status ?? null})
        and (${filters.q ?? null}::text is null or title ilike ${filters.q ? `%${filters.q}%` : null})
      order by created_at desc
      limit ${limit + 1} offset ${offset}
    `;
    return { data: rows.slice(0, limit), hasMore: rows.length > limit };
  });
}

export interface ListWorkflowsApiFilters {
  status?: WorkflowStatus;
  processId?: string;
}

export async function listWorkflowsForApi(
  context: TenantContext,
  filters: ListWorkflowsApiFilters,
  limit: number,
  offset: number,
): Promise<PagedResult<WorkflowRow>> {
  return withTenantContext(context, async (tx) => {
    const rows = await tx<WorkflowRow[]>`
      select * from workflows
      where organization_id = ${context.organizationId}
        and (${filters.status ?? null}::text is null or status = ${filters.status ?? null})
        and (${filters.processId ?? null}::uuid is null or process_id = ${filters.processId ?? null})
      order by started_at desc
      limit ${limit + 1} offset ${offset}
    `;
    return { data: rows.slice(0, limit), hasMore: rows.length > limit };
  });
}
