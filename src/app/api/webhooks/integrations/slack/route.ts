import { NextResponse, type NextRequest } from "next/server";
import { getAdminSql } from "@/lib/db/client-admin";
import {
  isSlackSignatureConfigured,
  verifySlackSignature,
} from "@/lib/integrations/slack-signature";

/**
 * Inbound events *from* Slack (the Events API) — distinct from the
 * outbound Slack OAuth connection (src/lib/integrations/providers/slack-provider.ts).
 * Verifies Slack's real request-signing scheme, then dedupes by
 * Slack's own `event_id` via inbound_webhook_events, same partial-
 * unique-on-processed idempotency shape as every other webhook route
 * in this codebase (Clerk, Stripe).
 *
 * Event-to-workflow mapping (turning a specific Slack event into a
 * ProcessPilot action — starting a workflow, creating a task, ...) is
 * a deliberate, documented gap in this phase: every verified event is
 * logged (processed, with its type), but no mapping configuration UI
 * exists yet to let an admin choose what a given event type should
 * trigger — see docs/architecture/integration-architecture.md's known
 * gaps.
 */
export async function POST(request: NextRequest) {
  if (!isSlackSignatureConfigured()) {
    console.error("Slack inbound webhook received but SLACK_SIGNING_SECRET is not configured.");
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const timestamp = request.headers.get("x-slack-request-timestamp");
  const signature = request.headers.get("x-slack-signature");
  if (!timestamp || !signature || !verifySlackSignature(rawBody, timestamp, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Slack's one-time Events API subscription handshake — must be
  // echoed back verbatim, unsigned-payload-shaped, before any other
  // processing.
  if (payload.type === "url_verification") {
    return NextResponse.json({ challenge: payload.challenge });
  }

  const eventId = typeof payload.event_id === "string" ? payload.event_id : null;
  if (!eventId) {
    return NextResponse.json({ error: "Missing event_id" }, { status: 400 });
  }

  const sql = getAdminSql();
  const eventType =
    typeof payload.event === "object" && payload.event !== null
      ? String((payload.event as { type?: unknown }).type ?? "unknown")
      : "unknown";

  const [claimed] = await sql<{ id: string }[]>`
    insert into inbound_webhook_events (provider, external_event_id, event_type, status)
    values ('slack', ${eventId}, ${eventType}, 'processed')
    on conflict (provider, external_event_id) where status = 'processed' do nothing
    returning id
  `;

  if (claimed) {
    await sql`update inbound_webhook_events set processed_at = now() where id = ${claimed.id}`;
  }

  return NextResponse.json({ received: true, deduped: !claimed });
}
