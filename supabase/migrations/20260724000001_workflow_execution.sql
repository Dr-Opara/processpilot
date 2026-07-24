-- Phase 8 (Workflow execution engine), second slice: the workflow/task
-- runtime schema. A `Workflow` is a running instance of exactly one
-- immutable `process_versions` row (ADR-0011); `Task` rows are the
-- individual node visits ("tokens", in Petri-net terms) the engine
-- creates as it walks the version's `definition` graph (nodes/edges —
-- see process-graph-validation.ts). workflow_history/task_history are
-- append-only instance timelines (finer-grained than audit_events, which
-- records only the governance-relevant subset per event-model.md).
--
-- RLS here follows the exact "coarse gate, fine-grained rule in the
-- service layer" split process_versions_update (20260719150002) already
-- established: a caller must hold *some* relevant workflow permission
-- (or be the specific assignee/starter) to pass the row-security check
-- at all; which specific transition that caller may actually perform is
-- enforced by src/lib/services/workflows.ts's own requirePermission()
-- and assignment-pool checks. This is necessary here, not just a style
-- choice: task completion by a plain `employee` (workflow.complete only)
-- legitimately cascades into updating the parent `workflows` row (e.g.
-- marking it completed) — a policy narrowed to workflow.manage alone
-- would lock that ordinary case out.

create table workflows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  department_id uuid references departments(id),
  process_id uuid not null references processes(id),
  process_version_id uuid not null references process_versions(id),
  -- Snapshot of process_versions.title at start time — never re-read live,
  -- so a workflow's displayed name can't appear to change out from under
  -- an in-flight instance (same immutability spirit as ADR-0011, applied
  -- to the instance's own record rather than the definition it points to).
  title text not null,
  status text not null default 'running' check (
    status in ('running', 'suspended', 'completed', 'cancelled', 'failed')
  ),
  started_by uuid references organization_members(id),
  started_at timestamptz not null default now(),
  -- From processes.sla_hours at start time, if set; checked by the
  -- 'workflow-deadline-check' background job (src/lib/services/workflow-jobs.ts).
  due_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references organization_members(id),
  suspended_at timestamptz,
  suspended_by uuid references organization_members(id),
  -- Set when status = 'failed' (a rejected required approval, or a
  -- decision node with zero or multiple matching branches — see
  -- src/lib/services/workflow-engine.ts).
  failure_reason text,
  -- Populated on the *new* workflow when restartWorkflow() cancels this
  -- one and starts a fresh instance from the same process_version —
  -- restart never rewinds an existing instance in place (that would
  -- mutate history), it always creates a new one.
  restarted_from_workflow_id uuid references workflows(id),
  created_at timestamptz not null default now()
);

create index workflows_organization_id_idx on workflows(organization_id);
create index workflows_process_id_idx on workflows(process_id);
create index workflows_started_by_idx on workflows(started_by) where started_by is not null;
-- Serves the deadline-check job's sweep: running workflows past due.
create index workflows_due_at_idx on workflows(due_at) where status = 'running' and due_at is not null;

create table tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  department_id uuid references departments(id),
  workflow_id uuid not null references workflows(id) on delete cascade,
  -- ProcessNode.id within workflows.process_version_id's definition —
  -- not a foreign key (the graph lives in JSONB, not its own table).
  node_id text not null,
  node_type text not null,
  label text not null,
  required boolean not null default true,
  status text not null default 'assigned' check (
    status in ('assigned', 'in_progress', 'completed', 'rejected', 'skipped', 'cancelled', 'failed')
  ),
  -- A task is either claimed by one specific member, or sits in an
  -- unclaimed pool (assignee_team_id/assignee_role_id set instead) that
  -- any eligible member can claim — see claimTask() in workflows.ts.
  -- Exactly one of the three should be set for an 'assigned' task; a
  -- system-executed node (start/end/decision/parallel_*/notification)
  -- has none.
  assignee_member_id uuid references organization_members(id),
  assignee_team_id uuid references teams(id),
  assignee_role_id uuid references roles(id),
  -- Form answers / approval decision / decision-branch outcome / system
  -- action result, depending on node_type. Read by decision nodes'
  -- condition evaluator (src/lib/services/workflow-condition.ts) keyed
  -- by node_id.
  output jsonb not null default '{}',
  started_at timestamptz not null default now(),
  -- Set for 'timer' nodes (now() + timerDurationMinutes); the
  -- 'workflow-timer-advance' background job fires at this time.
  due_at timestamptz,
  completed_at timestamptz,
  completed_by uuid references organization_members(id),
  created_at timestamptz not null default now(),
  -- A validated graph can still legally route more than one parallel
  -- branch into the same non-join node (the validator only requires
  -- parallel_join to have >= 2 incoming edges, it doesn't forbid a plain
  -- node from having them too) — that's a malformed graph in practice,
  -- and this constraint turns it into a clean application-level error
  -- (see workflow-engine.ts's activateNode) instead of two silently
  -- divergent task rows for one graph node.
  unique (workflow_id, node_id)
);

create index tasks_organization_id_idx on tasks(organization_id);
create index tasks_workflow_id_idx on tasks(workflow_id);
create index tasks_assignee_member_id_idx on tasks(assignee_member_id) where assignee_member_id is not null;
-- Serves "my task inbox" and pool-claim listing.
create index tasks_status_idx on tasks(status) where status in ('assigned', 'in_progress');
create index tasks_due_at_idx on tasks(due_at) where status in ('assigned', 'in_progress') and due_at is not null;

-- Subprocess linkage: the *child* workflow points back at the task (on
-- the parent workflow) that spawned it. Added as a plain column with an
-- FK to tasks, which by this point in the migration already exists.
alter table workflows add column parent_task_id uuid references tasks(id);
create index workflows_parent_task_id_idx on workflows(parent_task_id) where parent_task_id is not null;

create table workflow_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  department_id uuid references departments(id),
  workflow_id uuid not null references workflows(id) on delete cascade,
  event_type text not null,
  actor_member_id uuid references organization_members(id),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index workflow_history_workflow_id_idx on workflow_history(workflow_id, created_at);
create index workflow_history_organization_id_idx on workflow_history(organization_id);

create table task_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  department_id uuid references departments(id),
  workflow_id uuid not null references workflows(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  event_type text not null,
  actor_member_id uuid references organization_members(id),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index task_history_task_id_idx on task_history(task_id, created_at);
create index task_history_workflow_id_idx on task_history(workflow_id);
create index task_history_organization_id_idx on task_history(organization_id);

-- department_id on every table above is denormalized from
-- process_versions.department_id at insert time, same trigger pattern
-- process_versions itself uses (set_process_version_department_id,
-- 20260719150002) — required so has_scoped_permission() can check
-- department scope without a join on every RLS evaluation.
create or replace function set_workflow_department_id()
returns trigger
language plpgsql
as $$
begin
  select department_id into new.department_id from process_versions where id = new.process_version_id;
  return new;
end;
$$;

create trigger workflows_set_department_id
  before insert on workflows
  for each row
  execute function set_workflow_department_id();

create or replace function set_task_department_id()
returns trigger
language plpgsql
as $$
begin
  select department_id into new.department_id from workflows where id = new.workflow_id;
  return new;
end;
$$;

create trigger tasks_set_department_id
  before insert on tasks
  for each row
  execute function set_task_department_id();

create or replace function set_workflow_history_department_id()
returns trigger
language plpgsql
as $$
begin
  select department_id into new.department_id from workflows where id = new.workflow_id;
  return new;
end;
$$;

create trigger workflow_history_set_department_id
  before insert on workflow_history
  for each row
  execute function set_workflow_history_department_id();

create trigger task_history_set_department_id
  before insert on task_history
  for each row
  execute function set_workflow_history_department_id();

alter table workflows enable row level security;
alter table tasks enable row level security;
alter table workflow_history enable row level security;
alter table task_history enable row level security;

create policy workflows_select on workflows
  for select
  using (
    organization_id = current_org_id()
    and (
      started_by = current_member_id()
      or has_scoped_permission('workflow.manage', department_id, null, null)
      or has_scoped_permission('workflow.assign', department_id, null, null)
      or exists (
        select 1 from tasks t
        where t.workflow_id = workflows.id and t.assignee_member_id = current_member_id()
      )
    )
  );

create policy workflows_insert on workflows
  for insert
  with check (organization_id = current_org_id() and has_scoped_permission('workflow.start', department_id, null, null));

-- Coarse gate — see migration header. The specific transition (advance,
-- suspend, resume, cancel, complete) is enforced by workflows.ts.
create policy workflows_update on workflows
  for update
  using (
    organization_id = current_org_id()
    and (
      started_by = current_member_id()
      or has_scoped_permission('workflow.manage', department_id, null, null)
      or has_scoped_permission('workflow.start', department_id, null, null)
      or exists (
        select 1 from tasks t
        where t.workflow_id = workflows.id and t.assignee_member_id = current_member_id()
      )
    )
  )
  with check (
    organization_id = current_org_id()
    and (
      started_by = current_member_id()
      or has_scoped_permission('workflow.manage', department_id, null, null)
      or has_scoped_permission('workflow.start', department_id, null, null)
      or exists (
        select 1 from tasks t
        where t.workflow_id = workflows.id and t.assignee_member_id = current_member_id()
      )
    )
  );

revoke all on workflows from anon, public, authenticated;
grant select, insert, update on workflows to authenticated;

create policy tasks_select on tasks
  for select
  using (
    organization_id = current_org_id()
    and (
      assignee_member_id = current_member_id()
      or has_scoped_permission('workflow.manage', department_id, null, null)
      or has_scoped_permission('workflow.assign', department_id, null, null)
      or has_scoped_permission('workflow.complete', department_id, null, null)
    )
  );

-- Task rows are created by the engine as a side effect of starting or
-- advancing a workflow — whoever is running that operation may hold
-- workflow.start (starting) or workflow.complete (advancing past a task
-- they just completed), not necessarily workflow.manage.
create policy tasks_insert on tasks
  for insert
  with check (
    organization_id = current_org_id()
    and (
      has_scoped_permission('workflow.start', department_id, null, null)
      or has_scoped_permission('workflow.complete', department_id, null, null)
      or has_scoped_permission('workflow.manage', department_id, null, null)
    )
  );

create policy tasks_update on tasks
  for update
  using (
    organization_id = current_org_id()
    and (
      assignee_member_id = current_member_id()
      or has_scoped_permission('workflow.complete', department_id, null, null)
      or has_scoped_permission('workflow.manage', department_id, null, null)
      or has_scoped_permission('approval.review', department_id, null, null)
    )
  )
  with check (
    organization_id = current_org_id()
    and (
      assignee_member_id = current_member_id()
      or has_scoped_permission('workflow.complete', department_id, null, null)
      or has_scoped_permission('workflow.manage', department_id, null, null)
      or has_scoped_permission('approval.review', department_id, null, null)
    )
  );

revoke all on tasks from anon, public, authenticated;
grant select, insert, update on tasks to authenticated;

create policy workflow_history_select on workflow_history
  for select
  using (
    organization_id = current_org_id()
    and (
      has_scoped_permission('workflow.manage', department_id, null, null)
      or has_scoped_permission('workflow.assign', department_id, null, null)
      or exists (
        select 1 from workflows w
        where w.id = workflow_history.workflow_id
          and (
            w.started_by = current_member_id()
            or exists (
              select 1 from tasks t where t.workflow_id = w.id and t.assignee_member_id = current_member_id()
            )
          )
      )
    )
  );

-- Append-only side effect of an already-permission-checked workflow
-- action, same reasoning as background_jobs_insert (20260719150004): no
-- separate permission gate beyond tenant match.
create policy workflow_history_insert on workflow_history
  for insert
  with check (organization_id = current_org_id());

revoke all on workflow_history from anon, public, authenticated;
grant select, insert on workflow_history to authenticated;

create policy task_history_select on task_history
  for select
  using (
    organization_id = current_org_id()
    and (
      has_scoped_permission('workflow.manage', department_id, null, null)
      or has_scoped_permission('workflow.assign', department_id, null, null)
      or exists (
        select 1 from tasks t
        where t.id = task_history.task_id and t.assignee_member_id = current_member_id()
      )
    )
  );

create policy task_history_insert on task_history
  for insert
  with check (organization_id = current_org_id());

revoke all on task_history from anon, public, authenticated;
grant select, insert on task_history to authenticated;
