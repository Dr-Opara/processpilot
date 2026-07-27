import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { createFakeSql, type FakeSql } from "@/lib/db/test-helpers/fake-sql";
import type { BillingWebhookEvent } from "@/lib/billing/adapter";

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({
  sql: undefined as unknown as FakeSql,
  configured: true,
  verify: undefined as unknown as (rawBody: string, signature: string) => BillingWebhookEvent,
}));

vi.mock("@/lib/db/client-admin", () => ({ getAdminSql: () => state.sql }));
vi.mock("@/lib/billing/availability", () => ({ isBillingConfigured: () => state.configured }));
vi.mock("@/lib/billing/get-provider", () => ({
  getBillingProvider: () => ({ verifyAndParseWebhook: state.verify }),
}));
vi.mock("@/lib/billing/plans", () => ({
  getStripePriceId: (plan: string) => (plan === "business" ? "price_business" : undefined),
}));

import { POST } from "./route";

function webhookRequest(body: string, signature = "sig_test") {
  return new NextRequest("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": signature },
    body,
  });
}

function createDedupingFakeSql() {
  const claimedEventIds = new Set<string>();
  const upserted: unknown[] = [];

  return createFakeSql([
    {
      match: (t) => t.includes("insert into billing_webhook_events") && t.includes("on conflict"),
      respond: (values) => {
        const eventId = String(values[0]);
        if (claimedEventIds.has(eventId)) return [];
        claimedEventIds.add(eventId);
        return [{ id: `bwe_${eventId}` }];
      },
    },
    { match: (t) => t.includes("update billing_webhook_events"), respond: () => [] },
    {
      match: (t) => t.includes("select id from organizations"),
      respond: () => [{ id: "org-1" }],
    },
    {
      match: (t) => t.includes("insert into subscriptions"),
      respond: (values) => {
        upserted.push(values);
        return [];
      },
    },
  ]);
}

describe("POST /api/webhooks/stripe", () => {
  it("returns 503 when billing isn't configured", async () => {
    state.configured = false;
    const response = await POST(webhookRequest("{}"));
    expect(response.status).toBe(503);
    state.configured = true;
  });

  it("returns 400 when the signature header is missing", async () => {
    const request = new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: "{}",
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 on a failed signature verification", async () => {
    state.verify = () => {
      throw new Error("bad signature");
    };
    const response = await POST(webhookRequest("{}"));
    expect(response.status).toBe(400);
  });

  it("syncs a subscription.updated event to the matching organization", async () => {
    state.verify = () => ({
      id: "evt_1",
      type: "customer.subscription.updated",
      subscription: {
        subscriptionId: "sub_1",
        customerId: "cus_1",
        priceId: "price_business",
        status: "active",
        currentPeriodStart: "2026-08-01T00:00:00.000Z",
        currentPeriodEnd: "2026-09-01T00:00:00.000Z",
        cancelAtPeriodEnd: false,
        trialEnd: null,
      },
    });
    state.sql = createDedupingFakeSql();

    const response = await POST(webhookRequest("{}"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ received: true, deduped: false });
  });

  it("is idempotent on a duplicate delivery of the same event id", async () => {
    state.verify = () => ({
      id: "evt_dup",
      type: "customer.subscription.updated",
      subscription: {
        subscriptionId: "sub_1",
        customerId: "cus_1",
        priceId: "price_business",
        status: "active",
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        trialEnd: null,
      },
    });
    state.sql = createDedupingFakeSql();

    await POST(webhookRequest("{}"));
    const second = await POST(webhookRequest("{}"));
    const body = await second.json();

    expect(body).toEqual({ received: true, deduped: true });
  });

  it("acknowledges an event type it doesn't act on", async () => {
    state.verify = () => ({ id: "evt_2", type: "invoice.paid", subscription: null });
    state.sql = createDedupingFakeSql();

    const response = await POST(webhookRequest("{}"));

    expect(response.status).toBe(200);
  });
});
