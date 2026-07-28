import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz", () => ({ requirePermission: vi.fn() }));
vi.mock("@/lib/db/tenant-context", () => ({ withTenantContext: vi.fn() }));
vi.mock("@/lib/jobs/enqueue", () => ({ enqueueJob: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/crypto/secret-box", () => ({
  isEncryptionConfigured: vi.fn(() => true),
  encryptSecret: vi.fn((value: string) => `enc(${value})`),
  decryptSecret: vi.fn((value: string) => value.replace(/^enc\(/, "").replace(/\)$/, "")),
}));

import { requirePermission } from "@/lib/authz";
import { withTenantContext } from "@/lib/db/tenant-context";
import { enqueueJob } from "@/lib/jobs/enqueue";
import { isEncryptionConfigured } from "@/lib/crypto/secret-box";
import {
  createFakeSql,
  asTransactionSql,
  asSql,
  type FakeQueryHandler,
} from "@/lib/db/test-helpers/fake-sql";
import { makeMembership } from "@/lib/db/test-helpers/service-fixtures";
import { AppError } from "@/lib/errors";
import {
  createWebhookSubscription,
  deleteWebhookSubscription,
  replayWebhookDelivery,
  triggerWebhookEvent,
} from "./webhooks";

function wireTenantContext(handlers: FakeQueryHandler[] = []) {
  const fakeSql = createFakeSql(handlers);
  vi.mocked(withTenantContext).mockImplementation(async (_ctx, fn) =>
    fn(asTransactionSql(fakeSql)),
  );
  return fakeSql;
}

beforeEach(() => {
  vi.mocked(requirePermission).mockReset();
  vi.mocked(enqueueJob).mockClear();
  vi.mocked(isEncryptionConfigured).mockReturnValue(true);
});

describe("createWebhookSubscription", () => {
  it("rejects a non-https target URL", async () => {
    await expect(
      createWebhookSubscription({
        targetUrl: "http://example.com/hook",
        eventTypes: ["workflow.completed"],
      }),
    ).rejects.toThrow(AppError);
  });

  it("rejects a private/internal target URL", async () => {
    await expect(
      createWebhookSubscription({
        targetUrl: "https://127.0.0.1/hook",
        eventTypes: ["workflow.completed"],
      }),
    ).rejects.toThrow(AppError);
  });

  it("throws when secret storage isn't configured", async () => {
    vi.mocked(isEncryptionConfigured).mockReturnValue(false);
    await expect(
      createWebhookSubscription({
        targetUrl: "https://example.com/hook",
        eventTypes: ["workflow.completed"],
      }),
    ).rejects.toThrow(AppError);
  });

  it("creates the subscription and returns the raw secret once", async () => {
    vi.mocked(requirePermission).mockResolvedValue(
      makeMembership({ permissions: ["integration.manage"] }),
    );
    const fakeSql = wireTenantContext([
      {
        match: (t) => t.includes("insert into webhook_subscriptions"),
        respond: () => [
          {
            id: "sub-1",
            organization_id: "org-1",
            target_url: "https://example.com/hook",
            event_types: ["workflow.completed"],
            encrypted_secret: "enc(whsec_x)",
            status: "active",
            created_by: "profile-1",
            created_at: "2026-08-04T00:00:00.000Z",
            updated_at: "2026-08-04T00:00:00.000Z",
          },
        ],
      },
      { match: (t) => t.includes("insert into audit_events"), respond: () => [{ id: "audit-1" }] },
    ]);

    const created = await createWebhookSubscription({
      targetUrl: "https://example.com/hook",
      eventTypes: ["workflow.completed"],
    });

    expect(created.secret).toMatch(/^whsec_/);
    expect(fakeSql.calls.some((c) => c.text.includes("insert into audit_events"))).toBe(true);
  });
});

describe("deleteWebhookSubscription", () => {
  it("throws not_found for a subscription outside the caller's organization", async () => {
    vi.mocked(requirePermission).mockResolvedValue(
      makeMembership({ permissions: ["integration.manage"] }),
    );
    wireTenantContext([
      { match: (t) => t.includes("delete from webhook_subscriptions"), respond: () => [] },
    ]);

    await expect(deleteWebhookSubscription("sub-1")).rejects.toThrow(AppError);
  });
});

describe("replayWebhookDelivery", () => {
  it("resets the delivery to pending and re-enqueues the job", async () => {
    vi.mocked(requirePermission).mockResolvedValue(
      makeMembership({ permissions: ["integration.manage"] }),
    );
    wireTenantContext([
      {
        match: (t) => t.includes("update webhook_deliveries"),
        respond: () => [{ id: "delivery-1", organization_id: "org-1", status: "pending" }],
      },
      { match: (t) => t.includes("insert into audit_events"), respond: () => [{ id: "audit-1" }] },
    ]);

    await replayWebhookDelivery("delivery-1");

    expect(enqueueJob).toHaveBeenCalledWith(
      expect.anything(),
      "org-1",
      expect.objectContaining({ jobType: "deliver-webhook" }),
    );
  });
});

describe("triggerWebhookEvent", () => {
  it("fans out to every active subscription matching the event type", async () => {
    const fakeSql = createFakeSql([
      {
        match: (t) => t.includes("from webhook_subscriptions"),
        respond: () => [{ id: "sub-1" }, { id: "sub-2" }],
      },
      {
        match: (t) => t.includes("insert into webhook_deliveries"),
        respond: () => [{ id: "delivery-1" }],
      },
    ]);

    await triggerWebhookEvent(asSql(fakeSql), "org-1", "workflow.completed", {
      workflowId: "wf-1",
    });

    expect(enqueueJob).toHaveBeenCalledTimes(2);
  });
});
