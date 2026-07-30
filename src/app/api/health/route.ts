import { NextResponse } from "next/server";

/**
 * Liveness — "is this process up." No dependency checks (that's
 * /api/ready's job): a liveness probe that itself depends on the
 * database would make an orchestrator restart a healthy instance
 * during a transient DB blip, which is the opposite of what liveness
 * checks are for.
 */
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
