-- Phase 10 (Approvals, SLAs, and escalations): configurable multi-step
-- approval chains, business-calendar-aware SLA tracking, and escalation
-- rules, layered on top of Phase 8's single-assignee `approval` node
-- exactly the way Phase 9 layered structured forms onto the generic
-- `form` node — see workflow-engine.ts's header comment for the same
-- "snapshot a linked policy/version at task-creation time" pattern
-- (tasks.form_version_id, now joined by tasks.approval_policy_id).
--
-- Four independent pieces:
-- 1. approval_policies/approval_decisions — a configurable approval
--    strategy (sequential/parallel/unanimous/majority/first_response/
--    any_one) fans one 'approval' task out into one approval_decisions
--    row per required approver; the task itself completes once the
--    policy's strategy condition is satisfied (approvals.ts).
-- 2. business_calendars/business_calendar_holidays — named, reusable
--    time zone + work-hours + holiday definitions business-calendar.ts
--    uses to compute a due date that skips nights/weekends/holidays,
--    rather than a naive `now() + N hours`.
-- 3. sla_definitions — a named, reusable target (N minutes, optionally
--    against a business calendar) for a task/approval/workflow;
--    sla.ts resolves the applicable definition and computes due_at.
-- 4. escalation_rules/escalation_events — numbered escalation levels
--    per SLA definition (each firing a reminder/reassign/escalate
--    action some number of minutes past due), and the append-only log
--    of every level that has actually fired — same
--    workflow_history/task_history shape from Phase 8, applied here to
--    SLA breaches instead of workflow state.

create table approval_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  department_id uuid references departments(id),
  name text not null,
  strategy text not null check (
    strategy in ('sequential', 'parallel', 'unanimous', 'majority', 'first_response', 'any_one')
  ),
  -- [{ type: 'user'|'role'|'manager'|'department_owner'|'process_owner'|'location_manager'|'team_manager'|'runtime_expression', value: string|null }, ...]
  -- Resolved into specific organization_members at task-creation time —
  -- same "resolve at instantiation/task-start time" rule
  -- workflow-engine.md already states for plain task assignment.
  -- 'runtime_expression' reuses workflow-condition.ts's `<nodeId>.<key>`
  -- grammar to read a member id out of an earlier task's output (e.g. a
  -- form field capturing "who requested this") — see
  -- approval-resolution.ts's resolveMemberIdsForRule.
  approver_rules jsonb not null default '[]',
  allow_delegation boolean not null default true,
  allow_abstain boolean not null default false,
  -- When true, the workflow's starter is excluded from every rule's
  -- resolved approver set (never allowed to approve their own request) —
  -- see approval-resolution.ts's createApprovalDecisions.
  prevent_self_approval boolean not null default false,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  archived_at timestamptz
);

create index approval_policies_organization_id_idx on approval_policies(organization_id);
create index approval_policies_department_id_idx on approval_policies(department_id) where department_id is not null;

alter table approval_policies enable row level security;

create policy approval_policies_select on approval_policies
  for select
  using (organization_id = current_org_id() and has_scoped_permission('approval.manage', department_id, null, null));

create policy approval_policies_insert on approval_policies
  for insert
  with check (organization_id = current_org_id() and has_scoped_permission('approval.manage', department_id, null, null));

create policy approval_policies_update on approval_policies
  for update
  using (organization_id = current_org_id() and has_scoped_permission('approval.manage', department_id, null, null))
  with check (organization_id = current_org_id() and has_scoped_permission('approval.manage', department_id, null, null));

revoke all on approval_policies from anon, public, authenticated;
grant select, insert, update on approval_policies to authenticated;

-- A 'approval' node's task snapshots the exact policy it was created
-- against — same immutable-reference pattern as
-- tasks.form_version_id/workflows.process_version_id, so a policy
-- edited mid-instance never changes what an in-flight approval requires.
alter table tasks add column approval_policy_id uuid references approval_policies(id);
create index tasks_approval_policy_id_idx on tasks(approval_policy_id) where approval_policy_id is not null;

create table approval_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  department_id uuid references departments(id),
  task_id uuid not null references tasks(id) on delete cascade,
  approval_policy_id uuid not null references approval_policies(id),
  approver_member_id uuid not null references organization_members(id),
  -- Enforced order for the 'sequential' strategy only; ignored by every
  -- other strategy (approvals.ts creates every decision at once
  -- regardless, so 'sequential' is really "the others' decisions exist
  -- but are not yet actionable until their turn").
  sequence_order integer not null default 0,
  status text not null default 'pending' check (
    status in ('pending', 'approved', 'rejected', 'changes_requested', 'abstained', 'delegated')
  ),
  comment text,
  decided_at timestamptz,
  delegated_to_member_id uuid references organization_members(id),
  delegated_from_member_id uuid references organization_members(id),
  is_override boolean not null default false,
  override_by_member_id uuid references organization_members(id),
  override_reason text,
  created_at timestamptz not null default now(),
  unique (task_id, approver_member_id)
);

create index approval_decisions_organization_id_idx on approval_decisions(organization_id);
create index approval_decisions_task_id_idx on approval_decisions(task_id);
create index approval_decisions_approver_member_id_idx on approval_decisions(approver_member_id);

create or replace function set_approval_decision_department_id()
returns trigger
language plpgsql
as $$
begin
  select department_id into new.department_id from tasks where id = new.task_id;
  return new;
end;
$$;

create trigger approval_decisions_set_department_id
  before insert on approval_decisions
  for each row
  execute function set_approval_decision_department_id();

alter table approval_decisions enable row level security;

create policy approval_decisions_select on approval_decisions
  for select
  using (
    organization_id = current_org_id()
    and (
      approver_member_id = current_member_id()
      or has_scoped_permission('approval.review', department_id, null, null)
      or has_scoped_permission('approval.manage', department_id, null, null)
      or has_scoped_permission('workflow.manage', department_id, null, null)
    )
  );

-- Rows are created by the engine as a side effect of activating an
-- approval task — whoever is running that operation may hold
-- workflow.start/workflow.complete rather than approval.review itself
-- (same reasoning as Phase 8's tasks_insert policy).
create policy approval_decisions_insert on approval_decisions
  for insert
  with check (
    organization_id = current_org_id()
    and (
      has_scoped_permission('workflow.start', department_id, null, null)
      or has_scoped_permission('workflow.complete', department_id, null, null)
      or has_scoped_permission('approval.manage', department_id, null, null)
      or has_scoped_permission('workflow.manage', department_id, null, null)
    )
  );

create policy approval_decisions_update on approval_decisions
  for update
  using (
    organization_id = current_org_id()
    and (
      approver_member_id = current_member_id()
      or has_scoped_permission('approval.manage', department_id, null, null)
      or has_scoped_permission('workflow.manage', department_id, null, null)
    )
  )
  with check (
    organization_id = current_org_id()
    and (
      approver_member_id = current_member_id()
      or has_scoped_permission('approval.manage', department_id, null, null)
      or has_scoped_permission('workflow.manage', department_id, null, null)
    )
  );

revoke all on approval_decisions from anon, public, authenticated;
grant select, insert, update on approval_decisions to authenticated;

create table business_calendars (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  department_id uuid references departments(id),
  name text not null,
  -- IANA time zone name (e.g. 'America/New_York') — all work-hour math
  -- in business-calendar.ts happens in this zone, not server-local time.
  timezone text not null default 'UTC',
  -- 0=Sunday .. 6=Saturday.
  work_days integer[] not null default '{1,2,3,4,5}',
  work_start_minutes integer not null default 540,
  work_end_minutes integer not null default 1020,
  created_at timestamptz not null default now(),
  constraint business_calendars_work_hours_check check (work_start_minutes < work_end_minutes)
);

create index business_calendars_organization_id_idx on business_calendars(organization_id);

alter table business_calendars enable row level security;

create policy business_calendars_select on business_calendars
  for select
  using (organization_id = current_org_id() and has_scoped_permission('sla.manage', department_id, null, null));

create policy business_calendars_insert on business_calendars
  for insert
  with check (organization_id = current_org_id() and has_scoped_permission('sla.manage', department_id, null, null));

create policy business_calendars_update on business_calendars
  for update
  using (organization_id = current_org_id() and has_scoped_permission('sla.manage', department_id, null, null))
  with check (organization_id = current_org_id() and has_scoped_permission('sla.manage', department_id, null, null));

revoke all on business_calendars from anon, public, authenticated;
grant select, insert, update on business_calendars to authenticated;

create table business_calendar_holidays (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  calendar_id uuid not null references business_calendars(id) on delete cascade,
  holiday_date date not null,
  name text not null,
  unique (calendar_id, holiday_date)
);

create index business_calendar_holidays_calendar_id_idx on business_calendar_holidays(calendar_id);
create index business_calendar_holidays_organization_id_idx on business_calendar_holidays(organization_id);

alter table business_calendar_holidays enable row level security;

create policy business_calendar_holidays_select on business_calendar_holidays
  for select
  using (organization_id = current_org_id());

create policy business_calendar_holidays_insert on business_calendar_holidays
  for insert
  with check (
    organization_id = current_org_id()
    and exists (
      select 1 from business_calendars bc
      where bc.id = business_calendar_holidays.calendar_id
        and has_scoped_permission('sla.manage', bc.department_id, null, null)
    )
  );

create policy business_calendar_holidays_delete on business_calendar_holidays
  for delete
  using (
    organization_id = current_org_id()
    and exists (
      select 1 from business_calendars bc
      where bc.id = business_calendar_holidays.calendar_id
        and has_scoped_permission('sla.manage', bc.department_id, null, null)
    )
  );

revoke all on business_calendar_holidays from anon, public, authenticated;
grant select, insert, delete on business_calendar_holidays to authenticated;

create table sla_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  department_id uuid references departments(id),
  name text not null,
  target_type text not null check (target_type in ('task', 'approval', 'workflow')),
  target_minutes integer not null check (target_minutes > 0),
  business_calendar_id uuid references business_calendars(id),
  -- Optional reminders before the due date fires (e.g. '{60,15}' — 60
  -- and 15 minutes before due), evaluated by the same background job
  -- that checks for breach. Post-breach escalation is a separate,
  -- numbered concept — see escalation_rules below.
  reminder_minutes_before_due integer[] not null default '{}',
  created_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'archived'))
);

create index sla_definitions_organization_id_idx on sla_definitions(organization_id);
create index sla_definitions_department_id_idx on sla_definitions(department_id) where department_id is not null;

alter table sla_definitions enable row level security;

create policy sla_definitions_select on sla_definitions
  for select
  using (organization_id = current_org_id() and has_scoped_permission('sla.manage', department_id, null, null));

create policy sla_definitions_insert on sla_definitions
  for insert
  with check (organization_id = current_org_id() and has_scoped_permission('sla.manage', department_id, null, null));

create policy sla_definitions_update on sla_definitions
  for update
  using (organization_id = current_org_id() and has_scoped_permission('sla.manage', department_id, null, null))
  with check (organization_id = current_org_id() and has_scoped_permission('sla.manage', department_id, null, null));

revoke all on sla_definitions from anon, public, authenticated;
grant select, insert, update on sla_definitions to authenticated;

-- A task/workflow snapshots which SLA definition set its due_at, purely
-- for traceability (escalation.ts reads it back to find the matching
-- escalation_rules) — the due_at value itself still lives on
-- tasks.due_at/workflows.due_at from Phase 8.
alter table tasks add column sla_definition_id uuid references sla_definitions(id);
alter table workflows add column sla_definition_id uuid references sla_definitions(id);
create index tasks_sla_definition_id_idx on tasks(sla_definition_id) where sla_definition_id is not null;
create index workflows_sla_definition_id_idx on workflows(sla_definition_id) where sla_definition_id is not null;

-- Pause/resume support for a running SLA clock (e.g. while a task is
-- blocked on something outside the workflow) — sla.ts's pauseTaskSla/
-- resumeTaskSla shift `due_at` forward by the wall-clock duration spent
-- paused rather than recomputing business time from scratch, and the
-- escalation background job (escalation-handlers.ts) skips a task
-- entirely while sla_paused_at is set.
alter table tasks add column sla_paused_at timestamptz;
alter table tasks add column sla_paused_minutes_total integer not null default 0;

create table escalation_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  department_id uuid references departments(id),
  sla_definition_id uuid not null references sla_definitions(id) on delete cascade,
  level integer not null check (level > 0),
  trigger_after_minutes_past_due integer not null check (trigger_after_minutes_past_due >= 0),
  action text not null check (
    action in ('remind', 'reassign', 'escalate_manager', 'escalate_process_owner', 'escalate_admin')
  ),
  -- Required only for 'reassign' (a specific member/role/team target,
  -- same shape as approval_policies.approver_rules' single-entry form);
  -- null for every escalate_* action, which resolves its target
  -- dynamically (the assignee's manager, the process owner, an admin).
  reassign_target jsonb,
  created_at timestamptz not null default now(),
  unique (sla_definition_id, level)
);

create index escalation_rules_sla_definition_id_idx on escalation_rules(sla_definition_id);
create index escalation_rules_organization_id_idx on escalation_rules(organization_id);

create or replace function set_escalation_rule_department_id()
returns trigger
language plpgsql
as $$
begin
  select department_id into new.department_id from sla_definitions where id = new.sla_definition_id;
  return new;
end;
$$;

create trigger escalation_rules_set_department_id
  before insert on escalation_rules
  for each row
  execute function set_escalation_rule_department_id();

alter table escalation_rules enable row level security;

create policy escalation_rules_select on escalation_rules
  for select
  using (organization_id = current_org_id() and has_scoped_permission('sla.manage', department_id, null, null));

create policy escalation_rules_insert on escalation_rules
  for insert
  with check (organization_id = current_org_id() and has_scoped_permission('sla.manage', department_id, null, null));

create policy escalation_rules_delete on escalation_rules
  for delete
  using (organization_id = current_org_id() and has_scoped_permission('sla.manage', department_id, null, null));

revoke all on escalation_rules from anon, public, authenticated;
grant select, insert, delete on escalation_rules to authenticated;

create table escalation_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  department_id uuid references departments(id),
  task_id uuid references tasks(id) on delete cascade,
  workflow_id uuid references workflows(id) on delete cascade,
  escalation_rule_id uuid references escalation_rules(id),
  -- 0 = a reminder (reminder_minutes_before_due), matching no
  -- escalation_rules row; > 0 = that rule's level fired.
  level integer not null default 0,
  action text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  constraint escalation_events_target_check check (task_id is not null or workflow_id is not null)
);

create index escalation_events_task_id_idx on escalation_events(task_id) where task_id is not null;
create index escalation_events_workflow_id_idx on escalation_events(workflow_id) where workflow_id is not null;
create index escalation_events_organization_id_idx on escalation_events(organization_id);

alter table escalation_events enable row level security;

create policy escalation_events_select on escalation_events
  for select
  using (
    organization_id = current_org_id()
    and (
      has_scoped_permission('sla.manage', department_id, null, null)
      or has_scoped_permission('workflow.manage', department_id, null, null)
      or has_scoped_permission('workflow.assign', department_id, null, null)
    )
  );

-- Append-only side effect of the escalation-check background job —
-- same reasoning as workflow_history_insert (20260724000001): no
-- separate permission gate beyond tenant match (the job runs as the
-- admin client, not a user session).
create policy escalation_events_insert on escalation_events
  for insert
  with check (organization_id = current_org_id());

revoke all on escalation_events from anon, public, authenticated;
grant select, insert on escalation_events to authenticated;

-- New Phase 10 permissions — approval.review already existed (Phase 4's
-- original matrix); approval.manage/sla.manage are new, added
-- incrementally the same way form.create/form.edit/form.publish were
-- for Phase 9.
insert into permissions (key, description) values
  ('approval.manage', 'Create/edit approval policies and administratively override a pending decision.'),
  ('sla.manage', 'Create/edit SLA definitions, business calendars, and escalation rules.');

insert into role_permissions (role_id, permission_id, scope)
select r.id, p.id, v.scope
from (values
  ('organization_admin', 'approval.manage', null),
  ('organization_admin', 'sla.manage', null),
  ('process_owner', 'approval.manage', 'scoped'),
  ('process_owner', 'sla.manage', 'scoped'),
  ('manager', 'approval.manage', 'scoped')
) as v(role_key, permission_key, scope)
join roles r on r.key = v.role_key and r.organization_id is null
join permissions p on p.key = v.permission_key;
