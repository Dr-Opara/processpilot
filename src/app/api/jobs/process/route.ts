import { NextResponse, type NextRequest } from "next/server";
import { processDueJobs } from "@/lib/jobs/worker";
import "@/lib/jobs/workflow-handlers";
import "@/lib/jobs/evidence-handlers";

/**
 * The Vercel Cron-triggered worker tick (see vercel.json's `crons`
 * entry) — reclaims stale locks, claims a batch of due jobs, and runs
 * each through its registered handler (src/lib/jobs/registry.ts).
 *
 * Vercel sends cron requests as GET with an `Authorization: Bearer
 * $CRON_SECRET` header when CRON_SECRET is set — see
 * https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs.
 * Without CRON_SECRET configured, every request is rejected rather than
 * left open — a missing secret is a misconfiguration to fix, not a
 * reason to accept unauthenticated triggers.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workerId = `vercel-cron-${crypto.randomUUID()}`;

  try {
    const result = await processDueJobs(workerId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Background job worker tick failed", error);
    return NextResponse.json({ error: "Worker tick failed" }, { status: 500 });
  }
}
