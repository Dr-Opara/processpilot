import { NextResponse } from "next/server";
import { checkReadiness } from "@/lib/observability/health";

/**
 * Readiness — "can this instance safely serve traffic." See
 * src/lib/observability/health.ts's header comment for exactly what
 * flips status to unavailable/degraded. Never returns a stack trace,
 * connection string, or any tenant data — only booleans/counts/names.
 */
export async function GET() {
  const result = await checkReadiness();
  const httpStatus = result.status === "unavailable" ? 503 : 200;
  return NextResponse.json(result, { status: httpStatus });
}
