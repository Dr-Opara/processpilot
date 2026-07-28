import { NextResponse } from "next/server";
import { authenticateApiRequest, logApiUsage, parsePagination } from "@/lib/api/authenticate";
import { resolveApiTenantContext } from "@/lib/api/tenant-context";
import { listWorkflowsForApi } from "@/lib/services/public-api";
import { toSafeErrorResponse } from "@/lib/errors";
import type { WorkflowStatus } from "@/lib/db/database.types";

/**
 * GET /api/v1/workflows — list workflow instances for the calling API
 * key's organization. See docs/architecture/public-api.md.
 * Scope: workflows:read.
 */
export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request, "workflows:read");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const { limit, offset } = parsePagination(url);

  try {
    const context = await resolveApiTenantContext(
      auth.auth.organizationId,
      auth.auth.createdByProfileId,
    );
    const { data, hasMore } = await listWorkflowsForApi(
      context,
      {
        status: (url.searchParams.get("status") as WorkflowStatus | null) ?? undefined,
        processId: url.searchParams.get("processId") ?? undefined,
      },
      limit,
      offset,
    );
    await logApiUsage(auth.auth, request, 200);
    return NextResponse.json({
      data: data.map((workflow) => ({
        id: workflow.id,
        title: workflow.title,
        status: workflow.status,
        processId: workflow.process_id,
        startedAt: workflow.started_at,
        completedAt: workflow.completed_at,
      })),
      pagination: { limit, offset, hasMore },
    });
  } catch (error) {
    const { status, body } = toSafeErrorResponse(error);
    await logApiUsage(auth.auth, request, status);
    return NextResponse.json({ error: { code: "error", message: body.error } }, { status });
  }
}
