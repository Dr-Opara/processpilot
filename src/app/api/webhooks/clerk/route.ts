import { verifyWebhook, type WebhookEvent } from "@clerk/nextjs/webhooks";
import { NextResponse, type NextRequest } from "next/server";
import type postgres from "postgres";
import { getAdminSql } from "@/lib/db/client-admin";
import {
  syncMembershipRemoved,
  syncMembershipUpserted,
  syncOrganizationArchived,
  syncOrganizationUpserted,
  syncUserDeleted,
  syncUserUpserted,
} from "@/lib/db/identity-sync";

/**
 * Verifies, acknowledges, and persists Clerk organization/membership/user
 * events — the Clerk<->ProcessPilot identity mapping described in
 * docs/architecture/clerk-supabase-identity-sync.md.
 *
 * Idempotency: `svix-id` (the Standard Webhooks delivery id — Clerk's
 * retries reuse it, so it's the correct dedupe key, not any resource id
 * inside the payload) is inserted into webhook_events *before* any sync
 * runs, guarded by a partial unique index on (clerk_event_id) where
 * status = 'processed' — see that migration's comment for why a plain
 * unique column would incorrectly block legitimate retries after a
 * failed attempt. A concurrent duplicate delivery loses the race on that
 * insert and is acknowledged as already-processed without re-running any
 * sync logic.
 */
export async function POST(request: NextRequest) {
  let event: WebhookEvent;

  try {
    event = await verifyWebhook(request);
  } catch (error) {
    console.error("Clerk webhook signature verification failed", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const clerkEventId = request.headers.get("svix-id");
  if (!clerkEventId) {
    console.error("Clerk webhook missing svix-id header after successful signature verification");
    return NextResponse.json({ error: "Missing event id" }, { status: 400 });
  }

  const sql = getAdminSql();

  try {
    const deduped = await sql.begin(async (tx) => {
      const [claimed] = await tx<{ id: string }[]>`
        insert into webhook_events (clerk_event_id, event_type, status)
        values (${clerkEventId}, ${event.type}, 'processed')
        on conflict (clerk_event_id) where status = 'processed' do nothing
        returning id
      `;

      if (!claimed) {
        return true;
      }

      const organizationId = await applyEvent(tx, event, clerkEventId);

      await tx`
        update webhook_events
        set organization_id = ${organizationId}, processed_at = now()
        where id = ${claimed.id}
      `;

      return false;
    });

    return NextResponse.json({ received: true, deduped });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Clerk webhook processing failed", { type: event.type, clerkEventId, message });

    // Best-effort failure record for support/debugging (no payload, no
    // secrets — see the webhook_events migration comment for why this is
    // never keyed the same way as a successful row).
    await sql`
      insert into webhook_events (clerk_event_id, event_type, status, error_message)
      values (${clerkEventId}, ${event.type}, 'failed', ${message})
    `.catch((insertError: unknown) => {
      console.error("Failed to record webhook failure", insertError);
    });

    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

async function applyEvent(
  tx: postgres.TransactionSql,
  event: WebhookEvent,
  correlationId: string,
): Promise<string | null> {
  switch (event.type) {
    case "user.created":
    case "user.updated":
      await syncUserUpserted(tx, event.data);
      return null;

    case "user.deleted":
      if (event.data.id) {
        await syncUserDeleted(tx, event.data.id);
      }
      return null;

    case "organization.created":
    case "organization.updated": {
      const organization = await syncOrganizationUpserted(tx, event.data, correlationId);
      return organization.id;
    }

    case "organization.deleted":
      if (event.data.id) {
        await syncOrganizationArchived(tx, event.data.id, correlationId);
      }
      return null;

    case "organizationMembership.created":
    case "organizationMembership.updated": {
      const member = await syncMembershipUpserted(tx, event.data, correlationId);
      return member.organization_id;
    }

    case "organizationMembership.deleted": {
      const result = await syncMembershipRemoved(tx, event.data, correlationId);
      return result?.organizationId ?? null;
    }

    default:
      // Every other Clerk event type this app doesn't yet act on is still
      // acknowledged (200) and logged in webhook_events above — never a
      // processing error.
      return null;
  }
}
