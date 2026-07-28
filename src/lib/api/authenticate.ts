import "server-only";
import { NextResponse } from "next/server";
import {
  checkRateLimit,
  recordApiUsage,
  verifyApiKey,
  type ApiKeyScope,
  type AuthenticatedApiKey,
} from "@/lib/services/api-keys";

/**
 * The public API's request gate — every /api/v1/* route calls this
 * first. Consistent error envelope (`{ error: { code, message } }`)
 * across every failure mode, per docs/architecture/public-api.md.
 */
export interface ApiErrorBody {
  error: { code: string; message: string };
}

function errorResponse(status: number, code: string, message: string): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: { code, message } }, { status });
}

export type ApiAuthResult =
  { ok: true; auth: AuthenticatedApiKey } | { ok: false; response: NextResponse<ApiErrorBody> };

export async function authenticateApiRequest(
  request: Request,
  requiredScope: ApiKeyScope,
): Promise<ApiAuthResult> {
  const authHeader = request.headers.get("authorization");
  const rawKey = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;
  if (!rawKey) {
    return {
      ok: false,
      response: errorResponse(401, "unauthorized", "Missing Authorization header."),
    };
  }

  const auth = await verifyApiKey(rawKey);
  if (!auth) {
    return {
      ok: false,
      response: errorResponse(401, "unauthorized", "Invalid or revoked API key."),
    };
  }

  if (!auth.scopes.includes(requiredScope)) {
    return {
      ok: false,
      response: errorResponse(
        403,
        "forbidden",
        `This API key is missing the "${requiredScope}" scope.`,
      ),
    };
  }

  const { limited } = await checkRateLimit(auth.apiKeyId);
  if (limited) {
    return {
      ok: false,
      response: errorResponse(429, "rate_limited", "Rate limit exceeded — try again shortly."),
    };
  }

  return { ok: true, auth };
}

/** Every route calls this once, right before returning, so usage is logged regardless of the outcome. */
export async function logApiUsage(
  auth: AuthenticatedApiKey,
  request: Request,
  statusCode: number,
): Promise<void> {
  const path = new URL(request.url).pathname;
  await recordApiUsage(auth.apiKeyId, auth.organizationId, request.method, path, statusCode).catch(
    (error: unknown) => {
      console.error("Failed to record API usage", error);
    },
  );
}

export interface PaginationParams {
  limit: number;
  offset: number;
}

const MAX_PAGE_SIZE = 100;

export function parsePagination(url: URL): PaginationParams {
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 20, 1), MAX_PAGE_SIZE);
  const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);
  return { limit, offset };
}
