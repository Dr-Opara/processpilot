import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { createFakeSql, type FakeSql } from "@/lib/db/test-helpers/fake-sql";
import { POST } from "./route";

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({ sql: undefined as unknown as FakeSql }));

vi.mock("@/lib/db/client-admin", () => ({
  getAdminSql: () => state.sql,
}));

// Standard Webhooks signing (the scheme Clerk's verifyWebhook checks
// against) — signed content is "{id}.{timestamp}.{payload}", HMAC-SHA256
// over the base64-decoded secret (after its "whsec_" prefix), base64
// encoded, prefixed "v1,". No svix package needed to construct this in
// tests; it's a stable, documented spec.
//
// Deliberately all-zero-byte base64 (not a randomly-generated-looking
// string) — a plausible-looking fake secret here previously tripped
// gitleaks' generic-api-key entropy check in CI as a false positive.
const TEST_SECRET = "whsec_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

function sign(id: string, timestamp: string, payload: string, secret: string) {
  const secretBytes = Buffer.from(secret.split("_")[1], "base64");
  const signedContent = `${id}.${timestamp}.${payload}`;
  const signature = crypto.createHmac("sha256", secretBytes).update(signedContent).digest("base64");
  return `v1,${signature}`;
}

function webhookRequest(headers: Record<string, string>, payload: string) {
  return new NextRequest("http://localhost/api/webhooks/clerk", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: payload,
  });
}

function signedRequest(id: string, payload: string) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  return webhookRequest(
    {
      "svix-id": id,
      "svix-timestamp": timestamp,
      "svix-signature": sign(id, timestamp, payload, TEST_SECRET),
    },
    payload,
  );
}

/** A fake DB where webhook_events' partial-unique-index dedupe is actually simulated via an in-memory Set. */
function createDedupingFakeSql() {
  const claimedEventIds = new Set<string>();

  return createFakeSql([
    {
      match: (text) => text.includes("insert into webhook_events") && text.includes("on conflict"),
      respond: (values) => {
        const eventId = String(values[0]);
        if (claimedEventIds.has(eventId)) return [];
        claimedEventIds.add(eventId);
        return [{ id: `webhook_event_${eventId}` }];
      },
    },
    { match: (t) => t.includes("update webhook_events"), respond: () => [] },
    { match: (t) => t.includes("select id from profiles"), respond: () => [{ id: "profile-1" }] },
    {
      match: (t) => t.includes("insert into organizations"),
      respond: (values) => [
        {
          id: "org-1",
          clerk_org_id: values[0],
          name: values[1],
          slug: values[2],
          created_at: "2026-07-19T00:00:00Z",
          updated_at: "2026-07-19T00:00:00Z",
          created_by: values[3],
          archived_at: null,
        },
      ],
    },
    { match: (t) => t.includes("insert into organization_settings"), respond: () => [] },
    { match: (t) => t.includes("insert into audit_events"), respond: () => [{ id: "audit-1" }] },
    {
      match: (t) => t.includes("insert into webhook_events") && t.includes("'failed'"),
      respond: () => [],
    },
  ]);
}

describe("POST /api/webhooks/clerk", () => {
  const originalSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;

  beforeAll(() => {
    process.env.CLERK_WEBHOOK_SIGNING_SECRET = TEST_SECRET;
  });

  afterAll(() => {
    process.env.CLERK_WEBHOOK_SIGNING_SECRET = originalSecret;
  });

  beforeEach(() => {
    state.sql = createDedupingFakeSql();
  });

  it("accepts a validly signed payload, persists it, and returns 200", async () => {
    const payload = JSON.stringify({
      type: "organization.created",
      data: { id: "org_test123", name: "Northstar", slug: "northstar" },
    });

    const response = await POST(signedRequest("msg_test1", payload));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, deduped: false });
    expect(state.sql.calls.some((c) => c.text.includes("insert into organizations"))).toBe(true);
  });

  it("rejects a payload with an invalid signature", async () => {
    const payload = JSON.stringify({ type: "organization.created", data: { id: "org_test123" } });
    const id = "msg_test";
    const timestamp = String(Math.floor(Date.now() / 1000));

    const response = await POST(
      webhookRequest(
        {
          "svix-id": id,
          "svix-timestamp": timestamp,
          "svix-signature": "v1,not-a-real-signature",
        },
        payload,
      ),
    );

    expect(response.status).toBe(400);
  });

  it("rejects a request missing signature headers entirely", async () => {
    const payload = JSON.stringify({ type: "organization.created", data: { id: "org_test123" } });

    const response = await POST(webhookRequest({}, payload));

    expect(response.status).toBe(400);
  });

  it("does not reprocess an event it has already recorded as processed (replay/idempotency)", async () => {
    const payload = JSON.stringify({
      type: "organization.created",
      data: { id: "org_test123", name: "Northstar", slug: "northstar" },
    });

    const first = await POST(signedRequest("msg_replay", payload));
    const second = await POST(signedRequest("msg_replay", payload));

    expect(await first.json()).toEqual({ received: true, deduped: false });
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ received: true, deduped: true });

    const orgInserts = state.sql.calls.filter((c) => c.text.includes("insert into organizations"));
    expect(orgInserts).toHaveLength(1);
  });

  it("acknowledges an unhandled event type without erroring", async () => {
    const payload = JSON.stringify({ type: "session.created", data: { id: "sess_test123" } });

    const response = await POST(signedRequest("msg_unhandled", payload));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, deduped: false });
  });
});
