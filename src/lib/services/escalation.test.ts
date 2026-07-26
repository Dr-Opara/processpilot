import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/services/exceptions", () => ({
  createSystemException: vi.fn().mockResolvedValue({}),
}));

import {
  createFakeSql,
  asTransactionSql,
  type FakeQueryHandler,
} from "@/lib/db/test-helpers/fake-sql";
import { createSystemException } from "@/lib/services/exceptions";
import { checkTaskEscalations } from "./escalation";
import type { TaskRow } from "@/lib/db/database.types";

function task(overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    id: "task-1",
    organization_id: "org-1",
    department_id: null,
    workflow_id: "wf-1",
    node_id: "node-1",
    node_type: "human_task",
    label: "Do the thing",
    required: true,
    status: "assigned",
    assignee_member_id: "member-1",
    assignee_team_id: null,
    assignee_role_id: null,
    output: {},
    started_at: new Date().toISOString(),
    due_at: null,
    completed_at: null,
    completed_by: null,
    created_at: new Date().toISOString(),
    form_version_id: null,
    approval_policy_id: null,
    sla_definition_id: "sla-1",
    sla_paused_at: null,
    sla_paused_minutes_total: 0,
    ...overrides,
  };
}

describe("checkTaskEscalations", () => {
  it("does nothing for a task with no SLA definition", async () => {
    const fakeSql = createFakeSql([]);
    await checkTaskEscalations(
      asTransactionSql(fakeSql),
      task({ sla_definition_id: null }),
      "org-1",
    );
    expect(fakeSql.calls.length).toBe(0);
  });

  it("does nothing before the due date if there are no reminder thresholds configured", async () => {
    const handlers: FakeQueryHandler[] = [
      {
        match: (t) => t.includes("from sla_definitions"),
        respond: () => [{ reminder_minutes_before_due: [] }],
      },
    ];
    const fakeSql = createFakeSql(handlers);
    const dueAt = new Date(Date.now() + 60 * 60_000).toISOString();

    await checkTaskEscalations(asTransactionSql(fakeSql), task({ due_at: dueAt }), "org-1");

    expect(fakeSql.calls.some((c) => c.text.includes("insert into escalation_events"))).toBe(false);
  });

  it("fires a reminder once its threshold is crossed, and does not fire it twice", async () => {
    const dueAt = new Date(Date.now() + 10 * 60_000).toISOString(); // 10 minutes from now
    const handlers: FakeQueryHandler[] = [
      {
        match: (t) => t.includes("from sla_definitions"),
        respond: () => [{ reminder_minutes_before_due: [15] }],
      },
      { match: (t) => t.includes("from escalation_events"), respond: () => [] },
      { match: (t) => t.includes("insert into escalation_events"), respond: () => [] },
    ];
    const fakeSql = createFakeSql(handlers);

    await checkTaskEscalations(asTransactionSql(fakeSql), task({ due_at: dueAt }), "org-1");

    expect(fakeSql.calls.some((c) => c.text.includes("insert into escalation_events"))).toBe(true);
  });

  it("does not re-fire a reminder whose threshold already has a matching escalation_events row", async () => {
    const dueAt = new Date(Date.now() + 10 * 60_000).toISOString();
    const handlers: FakeQueryHandler[] = [
      {
        match: (t) => t.includes("from sla_definitions"),
        respond: () => [{ reminder_minutes_before_due: [15] }],
      },
      {
        match: (t) => t.includes("from escalation_events"),
        respond: () => [{ metadata: { reminderMinutesBeforeDue: 15 } }],
      },
    ];
    const fakeSql = createFakeSql(handlers);

    await checkTaskEscalations(asTransactionSql(fakeSql), task({ due_at: dueAt }), "org-1");

    expect(fakeSql.calls.some((c) => c.text.includes("insert into escalation_events"))).toBe(false);
  });

  it("is a no-op past due when no escalation_rules exist yet", async () => {
    const dueAt = new Date(Date.now() - 60_000).toISOString();
    const handlers: FakeQueryHandler[] = [
      { match: (t) => t.includes("from escalation_rules"), respond: () => [] },
      {
        match: (t) => t.includes("from escalation_events") && !t.includes("insert"),
        respond: () => [],
      },
    ];
    const fakeSql = createFakeSql(handlers);

    await checkTaskEscalations(asTransactionSql(fakeSql), task({ due_at: dueAt }), "org-1");

    expect(fakeSql.calls.some((c) => c.text.includes("insert into escalation_events"))).toBe(false);
  });

  it("fires an unfired past-due level, logging the event and reassigning for a 'reassign' action", async () => {
    const dueAt = new Date(Date.now() - 60_000).toISOString();
    const handlers: FakeQueryHandler[] = [
      {
        match: (t) => t.includes("from escalation_rules"),
        respond: () => [
          {
            id: "rule-1",
            level: 1,
            trigger_after_minutes_past_due: 0,
            action: "reassign",
            reassign_target: { type: "user", value: "member-2" },
          },
        ],
      },
      {
        match: (t) => t.includes("select escalation_rule_id from escalation_events"),
        respond: () => [],
      },
      { match: (t) => t.includes("update tasks set assignee_member_id"), respond: () => [] },
      { match: (t) => t.includes("insert into task_history"), respond: () => [] },
      { match: (t) => t.includes("insert into escalation_events"), respond: () => [] },
      { match: (t) => t.includes("insert into audit_events"), respond: () => [{ id: "audit-1" }] },
    ];
    const fakeSql = createFakeSql(handlers);

    await checkTaskEscalations(asTransactionSql(fakeSql), task({ due_at: dueAt }), "org-1");

    expect(fakeSql.calls.some((c) => c.text.includes("update tasks set assignee_member_id"))).toBe(
      true,
    );
    expect(fakeSql.calls.some((c) => c.text.includes("insert into escalation_events"))).toBe(true);
  });

  it("does nothing while the task's SLA clock is paused, even past due", async () => {
    const dueAt = new Date(Date.now() - 60_000).toISOString();
    const fakeSql = createFakeSql([]);

    await checkTaskEscalations(
      asTransactionSql(fakeSql),
      task({ due_at: dueAt, sla_paused_at: new Date().toISOString() }),
      "org-1",
    );

    expect(fakeSql.calls.length).toBe(0);
  });

  it("records a missed-SLA exception when escalation reaches the admin level", async () => {
    vi.mocked(createSystemException).mockClear();
    const dueAt = new Date(Date.now() - 60_000).toISOString();
    const handlers: FakeQueryHandler[] = [
      {
        match: (t) => t.includes("from escalation_rules"),
        respond: () => [
          {
            id: "rule-1",
            level: 1,
            trigger_after_minutes_past_due: 0,
            action: "escalate_admin",
            reassign_target: null,
          },
        ],
      },
      {
        match: (t) => t.includes("select escalation_rule_id from escalation_events"),
        respond: () => [],
      },
      {
        match: (t) => t.includes("from member_role_assignments"),
        respond: () => [{ organization_member_id: "admin-1" }],
      },
      { match: (t) => t.includes("update tasks set assignee_member_id"), respond: () => [] },
      { match: (t) => t.includes("insert into escalation_events"), respond: () => [] },
      { match: (t) => t.includes("insert into audit_events"), respond: () => [{ id: "audit-1" }] },
    ];
    const fakeSql = createFakeSql(handlers);

    await checkTaskEscalations(asTransactionSql(fakeSql), task({ due_at: dueAt }), "org-1");

    expect(createSystemException).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ source: "missed_sla", exceptionType: "missed_sla" }),
    );
  });

  it("does not re-fire a level that has already been logged (idempotent retry)", async () => {
    const dueAt = new Date(Date.now() - 60_000).toISOString();
    const handlers: FakeQueryHandler[] = [
      {
        match: (t) => t.includes("from escalation_rules"),
        respond: () => [
          {
            id: "rule-1",
            level: 1,
            trigger_after_minutes_past_due: 0,
            action: "remind",
            reassign_target: null,
          },
        ],
      },
      {
        match: (t) => t.includes("select escalation_rule_id from escalation_events"),
        respond: () => [{ escalation_rule_id: "rule-1" }],
      },
    ];
    const fakeSql = createFakeSql(handlers);

    await checkTaskEscalations(asTransactionSql(fakeSql), task({ due_at: dueAt }), "org-1");

    expect(fakeSql.calls.some((c) => c.text.includes("insert into escalation_events"))).toBe(false);
  });
});
