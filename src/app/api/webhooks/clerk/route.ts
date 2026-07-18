import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Verifies and acknowledges Clerk organization/membership/user events.
 *
 * Persisting these into ProcessPilot's own tables (the actual
 * "IDENTITY MAPPING" / Clerk<->Supabase bridge) is Phase 4's job per
 * docs/project/phase-tracker.md — there is no database yet. This phase
 * only proves the endpoint is reachable and correctly rejects
 * unsigned/invalid requests; log-only for now, on purpose.
 */
export async function POST(request: NextRequest) {
  let event: Awaited<ReturnType<typeof verifyWebhook>>;

  try {
    event = await verifyWebhook(request);
  } catch (error) {
    console.error("Clerk webhook signature verification failed", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  console.log("Clerk webhook received", { type: event.type, id: event.data.id });

  return NextResponse.json({ received: true });
}
