import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client-admin", () => ({ getAdminSql: vi.fn() }));
vi.mock("@/lib/notifications/availability", () => ({ isEmailConfigured: vi.fn() }));
vi.mock("@/lib/notifications/get-provider", () => ({ getEmailProvider: vi.fn() }));

import { getAdminSql } from "@/lib/db/client-admin";
import { isEmailConfigured } from "@/lib/notifications/availability";
import { getEmailProvider } from "@/lib/notifications/get-provider";
import { getJobHandler } from "@/lib/jobs/registry";
import { createFakeSql, asSql, type FakeQueryHandler } from "@/lib/db/test-helpers/fake-sql";
import type { BackgroundJobRow } from "@/lib/db/database.types";

import "./notification-handlers";

function job(overrides: Partial<BackgroundJobRow> = {}): BackgroundJobRow {
  return {
    id: "job-1",
    organization_id: "org-1",
    job_type: "deliver-notification-email",
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
  notification_id: "notif-1",
  organization_id: "org-1",
  status: "pending",
};
const notification = {
  id: "notif-1",
  recipient_member_id: "member-1",
  notification_type: "task_assigned",
  title: "New task",
  body: "You've been assigned a task.",
};

describe("deliver-notification-email handler", () => {
  it("is a no-op for an already-resolved delivery", async () => {
    const fakeSql = wireAdminSql([
      {
        match: (t) => t.includes("from notification_deliveries"),
        respond: () => [{ ...delivery, status: "sent" }],
      },
    ]);

    await getJobHandler("deliver-notification-email")!({ job: job() });

    expect(fakeSql.calls.some((c) => c.text.includes("update notification_deliveries"))).toBe(
      false,
    );
  });

  it("marks the delivery skipped_demo_workspace, without throwing, for the demo organization", async () => {
    vi.mocked(isEmailConfigured).mockReturnValue(true);
    const fakeSql = wireAdminSql([
      { match: (t) => t.includes("from notification_deliveries"), respond: () => [delivery] },
      { match: (t) => t.includes("from notifications"), respond: () => [notification] },
      {
        match: (t) => t.includes("select is_demo from organizations"),
        respond: () => [{ is_demo: true }],
      },
      { match: (t) => t.includes("update notification_deliveries"), respond: () => [] },
    ]);

    await getJobHandler("deliver-notification-email")!({ job: job() });

    expect(
      fakeSql.calls.some(
        (c) =>
          c.text.includes("update notification_deliveries") &&
          c.text.includes("skipped_demo_workspace"),
      ),
    ).toBe(true);
  });

  it("marks the delivery skipped_not_configured, without throwing, when email isn't configured", async () => {
    vi.mocked(isEmailConfigured).mockReturnValue(false);
    const fakeSql = wireAdminSql([
      { match: (t) => t.includes("from notification_deliveries"), respond: () => [delivery] },
      { match: (t) => t.includes("from notifications"), respond: () => [notification] },
      { match: (t) => t.includes("update notification_deliveries"), respond: () => [] },
    ]);

    await getJobHandler("deliver-notification-email")!({ job: job() });

    expect(
      fakeSql.calls.some(
        (c) =>
          c.text.includes("update notification_deliveries") &&
          c.text.includes("skipped_not_configured"),
      ),
    ).toBe(true);
  });

  it("sends via the configured provider and marks the delivery sent", async () => {
    vi.mocked(isEmailConfigured).mockReturnValue(true);
    const send = vi.fn().mockResolvedValue({ providerMessageId: "msg-1" });
    vi.mocked(getEmailProvider).mockReturnValue({ name: "resend", send });
    const fakeSql = wireAdminSql([
      { match: (t) => t.includes("from notification_deliveries"), respond: () => [delivery] },
      { match: (t) => t.includes("from notifications"), respond: () => [notification] },
      {
        match: (t) => t.includes("select p.email"),
        respond: () => [{ email: "member@example.com" }],
      },
      { match: (t) => t.includes("update notification_deliveries"), respond: () => [] },
    ]);

    await getJobHandler("deliver-notification-email")!({ job: job() });

    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: "member@example.com" }));
    expect(
      fakeSql.calls.some(
        (c) => c.text.includes("update notification_deliveries") && c.text.includes("'sent'"),
      ),
    ).toBe(true);
  });

  it("marks the delivery failed and rethrows on a provider error, so the worker retries", async () => {
    vi.mocked(isEmailConfigured).mockReturnValue(true);
    const send = vi.fn().mockRejectedValue(new Error("network error"));
    vi.mocked(getEmailProvider).mockReturnValue({ name: "resend", send });
    const fakeSql = wireAdminSql([
      { match: (t) => t.includes("from notification_deliveries"), respond: () => [delivery] },
      { match: (t) => t.includes("from notifications"), respond: () => [notification] },
      {
        match: (t) => t.includes("select p.email"),
        respond: () => [{ email: "member@example.com" }],
      },
      { match: (t) => t.includes("update notification_deliveries"), respond: () => [] },
    ]);

    await expect(getJobHandler("deliver-notification-email")!({ job: job() })).rejects.toThrow(
      "network error",
    );

    expect(
      fakeSql.calls.some(
        (c) => c.text.includes("update notification_deliveries") && c.text.includes("'failed'"),
      ),
    ).toBe(true);
  });

  it("retries a previously-failed delivery rather than treating it as final", async () => {
    vi.mocked(isEmailConfigured).mockReturnValue(true);
    const send = vi.fn().mockResolvedValue({ providerMessageId: "msg-2" });
    vi.mocked(getEmailProvider).mockReturnValue({ name: "resend", send });
    wireAdminSql([
      {
        match: (t) => t.includes("from notification_deliveries"),
        respond: () => [{ ...delivery, status: "failed" }],
      },
      { match: (t) => t.includes("from notifications"), respond: () => [notification] },
      {
        match: (t) => t.includes("select p.email"),
        respond: () => [{ email: "member@example.com" }],
      },
      { match: () => true, respond: () => [] },
    ]);

    await getJobHandler("deliver-notification-email")!({ job: job() });

    expect(send).toHaveBeenCalled();
  });
});
