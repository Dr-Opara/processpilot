import { NextResponse } from "next/server";
import { authenticateApiRequest, logApiUsage, parsePagination } from "@/lib/api/authenticate";
import { resolveApiTenantContext } from "@/lib/api/tenant-context";
import { listProcessesForApi } from "@/lib/services/public-api";
import { toSafeErrorResponse } from "@/lib/errors";

/**
 * GET /api/v1/processes — list processes for the calling API key's
 * organization. See docs/architecture/public-api.md.
 * Scope: processes:read.
 */
export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request, "processes:read");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const { limit, offset } = parsePagination(url);

  try {
    const context = await resolveApiTenantContext(
      auth.auth.organizationId,
      auth.auth.createdByProfileId,
    );
    const { data, hasMore } = await listProcessesForApi(
      context,
      {
        status: url.searchParams.get("status") ?? undefined,
        q: url.searchParams.get("q") ?? undefined,
      },
      limit,
      offset,
    );
    await logApiUsage(auth.auth, request, 200);
    return NextResponse.json({
      data: data.map((process) => ({
        id: process.id,
        title: process.title,
        status: process.status,
        category: process.category,
        departmentId: process.department_id,
        createdAt: process.created_at,
        updatedAt: process.updated_at,
      })),
      pagination: { limit, offset, hasMore },
    });
  } catch (error) {
    const { status, body } = toSafeErrorResponse(error);
    await logApiUsage(auth.auth, request, status);
    return NextResponse.json({ error: { code: "error", message: body.error } }, { status });
  }
}
