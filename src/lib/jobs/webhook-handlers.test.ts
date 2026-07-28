import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client-admin", () => ({ getAdminSql: vi.fn() }));
vi.mock("@/lib/services/webhooks", () => ({ decryptWebhookSecret: vi.fn(() => "whsec_test") }));

import { getAdminSql } from "@/lib/db/client-admin";
import { getJobHandler } from "@/lib/jobs/registry";
import { createFakeSql, asSql, type FakeQueryHandler } from "@/lib/db/test-helpers/fake-sql";
import type { BackgroundJobRow } from "@/lib/db/database.types";

import "./webhook-handlers";

function job(overrides: Partial<BackgroundJobRow> = {}): BackgroundJobRow {
  return {
    id: "job-1",
    organization_id: "org-1",
    job_type: "deliver-webhook",
    payload: { deliveryId: "delivery-1" },
    idempotency_key: "key-1",
    priority: 0,
    status: "processing",
    attempts: 1,
    max_attempts: 5,
    scheduled_at: new Date().toISOString(),
    last_error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: null,
    ...overrides,
  } as BackgroundJobRow;
}

function wireAdminSql(handlers: FakeQueryHandler[]) {
  const fakeSql = createFakeSql(handlers);
  vi.mocked(getAdminSql).mockReturnValue(asSql(fakeSql));
  return fakeSql;
}

const delivery = {
  id: "delivery-1",
  subscription_id: "sub-1",
  organization_id: "org-1",
  event_type: "workflow.completed",
  payload: { workflowId: "wf-1" },
  status: "pending",
};
const subscription = {
  id: "sub-1",
  organization_id: "org-1",
  target_url: "https://example.com/hook",
  event_types: ["workflow.completed"],
  encrypted_secret: "enc(whsec_test)",
  status: "active",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("deliver-webhook handler", () => {
  it("is a no-op for an already-delivered delivery", async () => {
    const fakeSql = wireAdminSql([
      {
        match: (t) => t.includes("from webhook_deliveries"),
        respond: () => [{ ...delivery, status: "delivered" }],
      },
    ]);

    await getJobHandler("deliver-webhook")!({ job: job() });

    expect(fakeSql.calls.some((c) => c.text.includes("update webhook_deliveries"))).toBe(false);
  });

  it("marks the delivery dead_letter when the subscription is disabled", async () => {
    const fakeSql = wireAdminSql([
      { match: (t) => t.includes("from webhook_deliveries"), respond: () => [delivery] },
      {
        match: (t) => t.includes("from webhook_subscriptions"),
        respond: () => [{ ...subscription, status: "disabled" }],
      },
      { match: (t) => t.includes("update webhook_deliveries"), respond: () => [] },
    ]);

    await getJobHandler("deliver-webhook")!({ job: job() });

    expect(
      fakeSql.calls.some(
        (c) => c.text.includes("update webhook_deliveries") && c.text.includes("dead_letter"),
      ),
    ).toBe(true);
  });

  it("marks the delivery delivered on a 2xx response and sends a signed payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    const fakeSql = wireAdminSql([
      { match: (t) => t.includes("from webhook_deliveries"), respond: () => [delivery] },
      { match: (t) => t.includes("from webhook_subscriptions"), respond: () => [subscription] },
      { match: (t) => t.includes("update webhook_deliveries"), respond: () => [] },
    ]);

    await getJobHandler("deliver-webhook")!({ job: job() });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/hook",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "X-ProcessPilot-Event": "workflow.completed" }),
      }),
    );
    expect(
      fakeSql.calls.some(
        (c) => c.text.includes("update webhook_deliveries") && c.text.includes("'delivered'"),
      ),
    ).toBe(true);
  });

  it("marks the delivery failed (retryable) and rethrows on a non-2xx response before the final attempt", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const fakeSql = wireAdminSql([
      { match: (t) => t.includes("from webhook_deliveries"), respond: () => [delivery] },
      { match: (t) => t.includes("from webhook_subscriptions"), respond: () => [subscription] },
      { match: (t) => t.includes("update webhook_deliveries"), respond: () => [] },
    ]);

    await expect(
      getJobHandler("deliver-webhook")!({ job: job({ attempts: 1, max_attempts: 5 }) }),
    ).rejects.toThrow();

    expect(
      fakeSql.calls.some(
        (c) => c.text.includes("update webhook_deliveries") && c.values.includes("failed"),
      ),
    ).toBe(true);
  });

  it("marks the delivery dead_letter on the final allowed attempt", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const fakeSql = wireAdminSql([
      { match: (t) => t.includes("from webhook_deliveries"), respond: () => [delivery] },
      { match: (t) => t.includes("from webhook_subscriptions"), respond: () => [subscription] },
      { match: (t) => t.includes("update webhook_deliveries"), respond: () => [] },
    ]);

    await expect(
      getJobHandler("deliver-webhook")!({ job: job({ attempts: 5, max_attempts: 5 }) }),
    ).rejects.toThrow();

    expect(
      fakeSql.calls.some(
        (c) => c.text.includes("update webhook_deliveries") && c.values.includes("dead_letter"),
      ),
    ).toBe(true);
  });
});
