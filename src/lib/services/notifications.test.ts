import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authz", () => ({
  getCurrentMembership: vi.fn(),
  requirePermission: vi.fn(),
}));
vi.mock("@/lib/db/tenant-context", () => ({
  withTenantContext: vi.fn(),
}));
vi.mock("@/lib/jobs/enqueue", () => ({
  enqueueJob: vi.fn().mockResolvedValue({}),
}));

import { getCurrentMembership, requirePermission } from "@/lib/authz";
import { withTenantContext } from "@/lib/db/tenant-context";
import { enqueueJob } from "@/lib/jobs/enqueue";
import {
  createFakeSql,
  asTransactionSql,
  type FakeQueryHandler,
} from "@/lib/db/test-helpers/fake-sql";
import { makeMembership } from "@/lib/db/test-helpers/service-fixtures";
import {
  createNotification,
  getUnreadNotificationCount,
  listMyNotifications,
  markNotificationRead,
  setMyNotificationPreference,
  setOrgDefaultNotificationPreference,
} from "./notifications";
import { AppError } from "@/lib/errors";
import type { NotificationRow } from "@/lib/db/database.types";

function wireTenantContext(handlers: FakeQueryHandler[] = []) {
  const fakeSql = createFakeSql(handlers);
  vi.mocked(withTenantContext).mockImplementation(async (_ctx, fn) =>
    fn(asTransactionSql(fakeSql)),
  );
  return fakeSql;
}

function notificationRow(overrides: Partial<NotificationRow> = {}): NotificationRow {
  return {
    id: "notif-1",
    organization_id: "org-1",
    department_id: null,
    recipient_member_id: "member-2",
    notification_type: "task_assigned",
    title: "New task",
    body: "You've been assigned a task.",
    resource_type: "task",
    resource_id: "task-1",
    read_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(getCurrentMembership).mockReset();
  vi.mocked(requirePermission).mockReset();
  vi.mocked(enqueueJob).mockClear();
});

describe("createNotification", () => {
  it("inserts the notification and schedules an email delivery when no preference overrides it", async () => {
    const fakeSql = createFakeSql([
      { match: (t) => t.includes("insert into notifications"), respond: () => [notificationRow()] },
      { match: (t) => t.includes("from notification_preferences"), respond: () => [] },
      {
        match: (t) => t.includes("insert into notification_deliveries"),
        respond: () => [{ id: "delivery-1" }],
      },
    ]);

    await createNotification(asTransactionSql(fakeSql), {
      organizationId: "org-1",
      recipientMemberId: "member-2",
      notificationType: "task_assigned",
      title: "New task",
      body: "You've been assigned a task.",
    });

    expect(fakeSql.calls.some((c) => c.text.includes("insert into notifications"))).toBe(true);
    expect(fakeSql.calls.some((c) => c.text.includes("insert into notification_deliveries"))).toBe(
      true,
    );
    expect(enqueueJob).toHaveBeenCalledWith(
      expect.anything(),
      "org-1",
      expect.objectContaining({ jobType: "deliver-notification-email" }),
    );
  });

  it("records a skipped_preference delivery and does not enqueue a job when the member opted out of email", async () => {
    const fakeSql = createFakeSql([
      { match: (t) => t.includes("insert into notifications"), respond: () => [notificationRow()] },
      {
        match: (t) => t.includes("from notification_preferences") && t.includes("member_id = ?"),
        respond: () => [{ email_enabled: false }],
      },
    ]);

    await createNotification(asTransactionSql(fakeSql), {
      organizationId: "org-1",
      recipientMemberId: "member-2",
      notificationType: "task_assigned",
      title: "New task",
      body: "You've been assigned a task.",
    });

    expect(
      fakeSql.calls.some(
        (c) =>
          c.text.includes("insert into notification_deliveries") &&
          c.text.includes("skipped_preference"),
      ),
    ).toBe(true);
    expect(enqueueJob).not.toHaveBeenCalled();
  });
});

describe("listMyNotifications / getUnreadNotificationCount / markNotificationRead", () => {
  it("scopes listMyNotifications to the current recipient", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    wireTenantContext([
      { match: (t) => t.includes("from notifications"), respond: () => [notificationRow()] },
    ]);

    const notifications = await listMyNotifications();

    expect(notifications).toHaveLength(1);
  });

  it("returns the unread count", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    wireTenantContext([
      { match: (t) => t.includes("count(*) as count"), respond: () => [{ count: "3" }] },
    ]);

    expect(await getUnreadNotificationCount()).toBe(3);
  });

  it("throws not_found when marking a notification that isn't the caller's", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    wireTenantContext([{ match: (t) => t.includes("update notifications"), respond: () => [] }]);

    await expect(markNotificationRead("notif-1")).rejects.toThrow(AppError);
  });
});

describe("notification preferences", () => {
  it("upserts a member's own preference", async () => {
    vi.mocked(getCurrentMembership).mockResolvedValue(makeMembership());
    const fakeSql = wireTenantContext([
      {
        match: (t) => t.includes("insert into notification_preferences"),
        respond: () => [
          {
            id: "pref-1",
            organization_id: "org-1",
            member_id: "member-1",
            notification_type: "task_assigned",
            email_enabled: false,
            created_at: "",
            updated_at: "",
          },
        ],
      },
    ]);

    const preference = await setMyNotificationPreference("task_assigned", false);

    expect(preference.email_enabled).toBe(false);
    expect(fakeSql.calls[0].text).toContain("member_id is not null");
  });

  it("requires organization.settings to set an org default", async () => {
    vi.mocked(requirePermission).mockRejectedValue(
      new AppError("forbidden", "Missing permission: organization.settings"),
    );

    await expect(setOrgDefaultNotificationPreference("task_assigned", false)).rejects.toThrow(
      AppError,
    );
  });
});
