# Workflow Engine

The workflow engine turns a published `ProcessVersion` into a running
`Workflow` composed of `Task` records, per the entities defined in the
[domain model](domain-model.md). Implemented in Phase 8
([src/lib/services/workflow-engine.ts](../../src/lib/services/workflow-engine.ts),
[src/lib/services/workflows.ts](../../src/lib/services/workflows.ts)).

## Execution model

Execution is token-based (Petri-net-style): each `tasks` row is one token
visit to one node in the process version's validated graph (nodes/edges —
see [process-graph-validation.ts](../../src/lib/services/process-graph-validation.ts),
which guarantees a single start, no cycles, and every node reachable
before a version can be published). `activateNode()` creates the task row
for a node ("a token arrives") and, for system-executed node types,
immediately runs their behavior and recurses onward, so one call for a
start node can synchronously walk an entire chain down to the first point
that needs a human action or a timer to elapse. `advanceFrom()` routes to
every outgoing edge's target from a just-completed node.

## Responsibilities

1. **Instantiation** — `instantiateWorkflow()` takes a `ProcessVersion`
   and creates the `Workflow` row plus its start node's task(s). Both
   `startWorkflow()` (manual, `workflow.start` permission) and
   `restartWorkflow()`/subprocess instantiation go through this one entry
   point.
2. **Sequencing** — advance tasks through linear, parallel, and
   conditional-branch paths as defined by the process version (see
   [Node types](#node-types) below).
3. **Assignment resolution** — a human-facing node's `assigneeType`
   (`role`/`team`) resolves at task-creation time into an unclaimed pool
   (`assignee_team_id`/`assignee_role_id`) that any eligible member can
   claim via `claimTask()`, or a specific `assignee_member_id` once
   claimed/assigned.
4. **Deadline tracking** — the `workflow-deadline-check` background job
   detects a running workflow past its `due_at` and records a
   `workflow.deadline_breached` history/audit event. A node's
   `data.slaDefinitionId` (Phase 10) instead resolves a business-
   calendar-aware `due_at` onto the task at creation time and schedules
   the `task-escalation-check` job, which handles reminders,
   reassignment, and manager/process-owner/admin escalation on top of
   this detection. See [approvals-and-slas.md](approvals-and-slas.md).
5. **Completion evaluation** — `maybeCompleteWorkflow()` marks a workflow
   `completed` once no task remains `assigned`/`in_progress`.

## Start triggers

| Trigger    | Description                                                                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Manual     | A permitted member starts a workflow from a published process's detail page or `startWorkflow()` (`workflow.start`).                      |
| Subprocess | A `subprocess` node instantiates a child workflow and blocks the parent task until the child completes (or fails, cascading the failure). |
| Restart    | `restartWorkflow()` cancels the current instance (if not already terminal) and starts a fresh one from the _same_ `process_version_id`.   |

Scheduled and event-triggered starts are not implemented in Phase 8.

## Node types

| Type             | Phase 8 behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `start`/`end`    | System-executed no-ops that mark graph position reached.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `human_task`     | Generic completion via `completeTask()` with a free-form `output` blob.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `form`           | If `data.formId` references a published Form (Phase 9), snapshots that version onto `tasks.form_version_id` at creation and completes via the structured, validated `submitForm()` instead of the generic path. Otherwise completes exactly like `human_task`. See [forms-and-evidence.md](forms-and-evidence.md).                                                                                                                                                                                                                                   |
| `evidence`       | Completes exactly like `human_task` — file uploads (Phase 9) attach to the task independently of its completion; the workflow does not block advancement pending evidence acceptance. See [forms-and-evidence.md](forms-and-evidence.md).                                                                                                                                                                                                                                                                                                            |
| `approval`       | If `data.approvalPolicyId` references an active ApprovalPolicy (Phase 10), snapshots it onto `tasks.approval_policy_id` at creation and fans out into one `approval_decisions` row per resolved approver, decided via `decideApprovalChain()` per the policy's strategy. Otherwise falls back to a single-assignee decision (`decideApproval()` — approve/reject). Either way, a rejected _required_ approval fails the whole workflow rather than routing down an unspecified rejection branch. See [approvals-and-slas.md](approvals-and-slas.md). |
| `decision`       | Evaluates each outgoing edge's condition (see [Condition grammar](#condition-grammar)) against the instance's accumulated task outputs; the first match wins. Zero matches fails the workflow.                                                                                                                                                                                                                                                                                                                                                       |
| `parallel_split` | System-executed; activates every outgoing edge's target.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `parallel_join`  | Activates once (not once per incoming branch) — only when every incoming branch's task has completed. A unique `(workflow_id, node_id)` constraint is the backstop against two branches racing past that check concurrently; the resulting insert conflict is swallowed as a no-op.                                                                                                                                                                                                                                                                  |
| `timer`          | Schedules a `workflow-timer-advance` background job for `now() + timerDurationMinutes`; the task stays `in_progress` until the job fires.                                                                                                                                                                                                                                                                                                                                                                                                            |
| `notification`   | Logs the configured message to `task_history` and marks the position reached. Delivery is Phase 16's job.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `subprocess`     | Instantiates a real child workflow (`instantiateWorkflow()`), blocking the parent task until it completes or fails.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `system_action`  | No handler yet. `startWorkflow()` rejects instantiating a version that contains one, rather than stranding a token mid-execution.                                                                                                                                                                                                                                                                                                                                                                                                                    |

## Condition grammar

A decision node's outgoing edges carry a free-text `condition` in the
form `<nodeId>.<key> <op> <value>`, where `<op>` is one of
`==`, `!=`, `>`, `>=`, `<`, `<=` and `<value>` is a JSON literal (quoted
string, number, or `true`/`false`) — e.g.
`approval-1.decision == "approved"` or `form-1.amount > 500`. `<nodeId>`
refers to another `tasks.node_id` earlier in the same workflow instance.
Deliberately not a general expression language — see
[workflow-condition.ts](../../src/lib/services/workflow-condition.ts).
Unparseable conditions are rejected at process-version review time
(`process-graph-validation.ts`), not discovered mid-execution.

## State machine

**Workflow status:** `running` → `suspended` (reversible, `suspendWorkflow()`/`resumeWorkflow()`) → `completed` | `cancelled` | `failed` (terminal).
Suspension/cancellation/failure are gated by `workflow.manage`; the
transition functions are the only place that mutates `status` — RLS on
the `workflows` table is a coarse gate (any relevant workflow permission,
or the assignee/starter), the specific transition is enforced in
[workflows.ts](../../src/lib/services/workflows.ts).

**Task status:** `assigned` → `in_progress` (claimed) → `completed` |
`rejected` (approval only) | `skipped` (non-required, admin-only) |
`cancelled` (workflow failed/cancelled while the task was open) |
`failed`.

## Background jobs

Two Phase 8 job handlers
([workflow-handlers.ts](../../src/lib/jobs/workflow-handlers.ts)),
registered against the provider-neutral background-job adapter
([ADR-0009](decisions/0009-provider-neutral-background-jobs.md)) and run
through the admin client rather than `withTenantContext()` — a cron tick
has no Clerk session to build tenant claims from, so each handler
independently re-checks `organization_id` on every query:

- `workflow-timer-advance` — completes a `timer` task and advances the
  graph. Idempotent: re-running after the task already advanced (or the
  workflow is no longer running) is a no-op, which is also how the
  system recovers cleanly from a crash between the job firing and the
  worker acknowledging it.
- `workflow-deadline-check` — records `workflow.deadline_breached` if a
  running workflow is past `due_at`; a no-op for a workflow that's since
  completed, been cancelled/failed, or been suspended (escalating a
  paused workflow would be noise).

## Relationship to approvals and evidence

Approval and evidence requirements are properties of a `Task` (or a step
within one), not a separate execution path — an approval-gated task
blocks workflow advancement the same way an incomplete required task
does. See [terminology](../../product/terminology.md) for the distinction
between `Task`, `Approval`, and `Evidence`.

## Immutability guarantee

A running or completed `Workflow` always references the specific
`ProcessVersion` it was instantiated from. If the parent `Process` is
later published as a new version, in-flight workflows are unaffected —
they continue executing against the version they started with. `restartWorkflow()`
never rewinds an existing instance in place (that would mutate its
history); it always cancels it and creates a new instance from the same
version. This is what makes historical workflow instances a reliable
audit record even after the underlying process has since changed.

## Routes

- `/app/workflows` — list, filterable by status and process.
- `/app/workflows/[workflowId]` — detail: tasks, history, and
  `workflow.manage`-gated suspend/resume/cancel/restart controls.
- `/app/tasks` — the current member's inbox (assigned, plus unclaimed
  pooled tasks they're eligible for).
- `/app/tasks/[taskId]` — detail: claim, complete/decide, reassign
  (`workflow.assign`), skip (`workflow.manage`, non-required only), and
  task history.

## Related documents

- [Event model](event-model.md)
- [Domain model](domain-model.md)
- [ADR-0010: Event-driven workflow execution](decisions/0010-event-driven-workflow-execution.md)
- [ADR-0011: Immutable published document and process versions](decisions/0011-immutable-published-versions.md)
