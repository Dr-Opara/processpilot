-- Phase 11 (Exception management): automatic and manual exception
-- creation, triage, investigation, containment, root-cause analysis,
-- corrective/preventive action (CAPA) plans, and temporary waivers, per
-- docs/architecture/domain-model.md's `Workflow -> Exception ->
-- CorrectiveAction` relationship and product/terminology.md's
-- definitions — expanded here into the fuller CAPA/quality-management
-- shape this phase's requirements call for.
--
-- Fifteen tables, in five groups:
-- 1. exceptions/exception_comments/exception_links/exception_history —
--    the core record, its discussion thread, its links to other
--    records (workflow/task/process/document/form/evidence/approval/
--    training/audit/other-exception/waiver — polymorphic by
--    `linked_type`/`linked_id`, validated at the service layer per
--    CLAUDE.md's "validate at system boundaries" rule since a single
--    FK can't target more than one table), and its append-only
--    lifecycle log (same shape as task_history/workflow_history).
-- 2. exception_containment_actions — immediate containment steps.
-- 3. root_cause_analyses/root_cause_factors — one analysis per
--    exception (five-whys/fishbone), with ordered factor rows.
-- 4. capa_plans/capa_actions/capa_approvals/capa_effectiveness_checks —
--    a CAPA plan's header, its individual action items, its approval
--    records, and its effectiveness-check history.
-- 5. temporary_waivers/waiver_approvals/waiver_renewals/
--    recurrence_matches — time-bound risk-acceptance records (with
--    their own approval/renewal history) and a plain heuristic
--    recurrence-detection log (same process/department/location/type/
--    root-cause-category/tag overlap within a lookback window,
--    computed at creation time — not a duplicate-detection guarantee).
--
-- No `controls` entity exists yet in the domain model (see
-- docs/architecture/domain-model.md) — a "control failure" exception
-- type and root-cause-analysis "control" references are free text
-- here, not a foreign key, since introducing a full Control register is
-- out of this phase's scope. Similarly no `training` table exists yet
-- (Phase 12), so `exception_links.linked_type = 'training'` has no
-- corresponding table to reference either.
--
-- All `on delete set null` (not `cascade`, unlike most Phase 8/9/10
-- workflow-scoped rows) on links to workflows/tasks/documents/forms/
-- evidence/approvals: an exception is a retained compliance record —
-- losing the workflow it originated from should not destroy the
-- exception itself.

create table exceptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  department_id uuid references departments(id),
  location_id uuid references organization_locations(id),
  team_id uuid references teams(id),
  title text not null,
  description text,
  exception_type text not null check (
    exception_type in (
      'process_deviation', 'policy_exception', 'control_failure', 'missed_sla',
      'evidence_deficiency', 'task_failure', 'security_issue', 'training_deficiency',
      'vendor_issue', 'data_quality_issue', 'other'
    )
  ),
  source text not null check (
    source in (
      'employee_submission', 'manager_submission', 'workflow_failure', 'task_failure',
      'missed_sla', 'failed_approval', 'evidence_rejection', 'form_submission',
      'audit_finding', 'integration_event', 'system_detected', 'administrative_entry'
    )
  ),
  severity text not null default 'moderate' check (severity in ('low', 'moderate', 'high', 'critical')),
  likelihood text check (likelihood in ('low', 'moderate', 'high')),
  impact text check (impact in ('low', 'moderate', 'high')),
  -- Computed by exceptions.ts's calculatePriority() from severity/
  -- likelihood/impact/regulatory-impact/recurrence/SLA-breach/customer-
  -- impact inputs at creation and on relevant updates; `priority_*`
  -- columns below record a manual override distinctly from that
  -- calculation, never silently replacing it.
  priority text check (priority in ('low', 'moderate', 'high', 'critical')),
  priority_overridden boolean not null default false,
  priority_override_reason text,
  status text not null default 'reported' check (
    status in (
      'reported', 'triaged', 'under_investigation', 'containment_in_progress',
      'action_plan_required', 'remediation_in_progress', 'pending_verification',
      'closed', 'rejected', 'reopened'
    )
  ),
  reporter_member_id uuid references organization_members(id),
  owner_member_id uuid references organization_members(id),
  investigator_member_id uuid references organization_members(id),
  process_id uuid references processes(id) on delete set null,
  process_version_id uuid references process_versions(id) on delete set null,
  workflow_id uuid references workflows(id) on delete set null,
  task_id uuid references tasks(id) on delete set null,
  document_id uuid references knowledge_documents(id) on delete set null,
  document_version_id uuid references document_versions(id) on delete set null,
  form_submission_id uuid references form_submissions(id) on delete set null,
  evidence_id uuid references evidence(id) on delete set null,
  approval_decision_id uuid references approval_decisions(id) on delete set null,
  -- Free text — see the header comment on why there is no controls FK.
  control_reference text,
  due_at timestamptz,
  detected_at timestamptz,
  occurred_at timestamptz,
  containment_summary text,
  root_cause_summary text,
  remediation_summary text,
  verification_summary text,
  closure_reason text,
  reopen_reason text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  created_by_member_id uuid references organization_members(id),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by_member_id uuid references organization_members(id)
);

create index exceptions_organization_id_idx on exceptions(organization_id);
create index exceptions_status_idx on exceptions(organization_id, status);
create index exceptions_severity_idx on exceptions(organization_id, severity);
create index exceptions_department_id_idx on exceptions(department_id) where department_id is not null;
create index exceptions_owner_member_id_idx on exceptions(owner_member_id) where owner_member_id is not null;
create index exceptions_workflow_id_idx on exceptions(workflow_id) where workflow_id is not null;
create index exceptions_task_id_idx on exceptions(task_id) where task_id is not null;
create index exceptions_process_id_idx on exceptions(process_id) where process_id is not null;
create index exceptions_due_at_idx on exceptions(due_at) where due_at is not null;
create index exceptions_recurrence_lookup_idx on exceptions(organization_id, exception_type, process_id, department_id, location_id);

alter table exceptions enable row level security;

create policy exceptions_select on exceptions
  for select
  using (
    organization_id = current_org_id()
    and (
      owner_member_id = current_member_id()
      or investigator_member_id = current_member_id()
      or reporter_member_id = current_member_id()
      or has_scoped_permission('exceptions.view', department_id, location_id, team_id)
      or has_scoped_permission('exceptions.manage', department_id, location_id, team_id)
    )
  );

-- Both system (background job / engine code, admin client) and
-- user-initiated (employee/manager submission) inserts land here — no
-- permission check beyond tenant match, same reasoning as
-- escalation_events_insert (20260726000001): exceptions.ts's
-- createException()/createSystemException() already call
-- requirePermission('exceptions.create') (or run as the admin client
-- from engine code) before this insert executes.
create policy exceptions_insert on exceptions
  for insert
  with check (organization_id = current_org_id());

create policy exceptions_update on exceptions
  for update
  using (
    organization_id = current_org_id()
    and (
      owner_member_id = current_member_id()
      or investigator_member_id = current_member_id()
      or has_scoped_permission('exceptions.edit', department_id, location_id, team_id)
      or has_scoped_permission('exceptions.triage', department_id, location_id, team_id)
      or has_scoped_permission('exceptions.investigate', department_id, location_id, team_id)
      or has_scoped_permission('exceptions.close', department_id, location_id, team_id)
      or has_scoped_permission('exceptions.manage', department_id, location_id, team_id)
    )
  )
  with check (
    organization_id = current_org_id()
    and (
      owner_member_id = current_member_id()
      or investigator_member_id = current_member_id()
      or has_scoped_permission('exceptions.edit', department_id, location_id, team_id)
      or has_scoped_permission('exceptions.triage', department_id, location_id, team_id)
      or has_scoped_permission('exceptions.investigate', department_id, location_id, team_id)
      or has_scoped_permission('exceptions.close', department_id, location_id, team_id)
      or has_scoped_permission('exceptions.manage', department_id, location_id, team_id)
    )
  );

revoke all on exceptions from anon, public, authenticated;
grant select, insert, update on exceptions to authenticated;

create table exception_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  department_id uuid references departments(id),
  exception_id uuid not null references exceptions(id) on delete cascade,
  author_member_id uuid not null references organization_members(id),
  body text not null,
  created_at timestamptz not null default now()
);

create index exception_comments_exception_id_idx on exception_comments(exception_id);
create index exception_comments_organization_id_idx on exception_comments(organization_id);

create or replace function set_exception_child_department_id()
returns trigger
language plpgsql
as $$
begin
  select department_id into new.department_id from exceptions where id = new.exception_id;
  return new;
end;
$$;

create trigger exception_comments_set_department_id
  before insert on exception_comments
  for each row
  execute function set_exception_child_department_id();

alter table exception_comments enable row level security;

create policy exception_comments_select on exception_comments
  for select
  using (
    organization_id = current_org_id()
    and (
      has_scoped_permission('exceptions.view', department_id, null, null)
      or has_scoped_permission('exceptions.manage', department_id, null, null)
      or exists (
        select 1 from exceptions e
        where e.id = exception_comments.exception_id
          and (e.owner_member_id = current_member_id() or e.investigator_member_id = current_member_id() or e.reporter_member_id = current_member_id())
      )
    )
  );

create policy exception_comments_insert on exception_comments
  for insert
  with check (
    organization_id = current_org_id()
    and author_member_id = current_member_id()
    and (
      has_scoped_permission('exceptions.view', department_id, null, null)
      or has_scoped_permission('exceptions.manage', department_id, null, null)
      or exists (
        select 1 from exceptions e
        where e.id = exception_comments.exception_id
          and (e.owner_member_id = current_member_id() or e.investigator_member_id = current_member_id() or e.reporter_member_id = current_member_id())
      )
    )
  );

revoke all on exception_comments from anon, public, authenticated;
grant select, insert on exception_comments to authenticated;

create table exception_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  exception_id uuid not null references exceptions(id) on delete cascade,
  linked_type text not null check (
    linked_type in (
      'workflow', 'task', 'process', 'document', 'control', 'form', 'evidence',
      'approval', 'training', 'audit_record', 'exception', 'waiver'
    )
  ),
  linked_id uuid not null,
  created_at timestamptz not null default now(),
  created_by_member_id uuid references organization_members(id),
  unique (exception_id, linked_type, linked_id)
);

create index exception_links_exception_id_idx on exception_links(exception_id);
create index exception_links_organization_id_idx on exception_links(organization_id);
create index exception_links_linked_idx on exception_links(linked_type, linked_id);

alter table exception_links enable row level security;

create policy exception_links_select on exception_links
  for select
  using (
    organization_id = current_org_id()
    and (has_scoped_permission('exceptions.view', null, null, null) or has_scoped_permission('exceptions.manage', null, null, null))
  );

create policy exception_links_insert on exception_links
  for insert
  with check (
    organization_id = current_org_id()
    and (has_scoped_permission('exceptions.edit', null, null, null) or has_scoped_permission('exceptions.manage', null, null, null))
  );

create policy exception_links_delete on exception_links
  for delete
  using (
    organization_id = current_org_id()
    and (has_scoped_permission('exceptions.edit', null, null, null) or has_scoped_permission('exceptions.manage', null, null, null))
  );

revoke all on exception_links from anon, public, authenticated;
grant select, insert, delete on exception_links to authenticated;

create table exception_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  department_id uuid references departments(id),
  exception_id uuid not null references exceptions(id) on delete cascade,
  event_type text not null,
  actor_member_id uuid references organization_members(id),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index exception_history_exception_id_idx on exception_history(exception_id);
create index exception_history_organization_id_idx on exception_history(organization_id);

create trigger exception_history_set_department_id
  before insert on exception_history
  for each row
  execute function set_exception_child_department_id();

alter table exception_history enable row level security;

create policy exception_history_select on exception_history
  for select
  using (
    organization_id = current_org_id()
    and (
      has_scoped_permission('exceptions.view', department_id, null, null)
      or has_scoped_permission('exceptions.manage', department_id, null, null)
    )
  );

-- Append-only side effect of every exception-mutating service call
-- (and the automatic-creation job) — same posture as
-- escalation_events_insert: no separate permission gate beyond tenant
-- match, since every write path already checked a permission before
-- reaching here.
create policy exception_history_insert on exception_history
  for insert
  with check (organization_id = current_org_id());

revoke all on exception_history from anon, public, authenticated;
grant select, insert on exception_history to authenticated;

create table exception_containment_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  department_id uuid references departments(id),
  exception_id uuid not null references exceptions(id) on delete cascade,
  action text not null,
  owner_member_id uuid not null references organization_members(id),
  due_at timestamptz,
  status text not null default 'open' check (status in ('open', 'completed', 'cancelled')),
  evidence_id uuid references evidence(id) on delete set null,
  verification_notes text,
  created_at timestamptz not null default now(),
  created_by_member_id uuid references organization_members(id),
  completed_at timestamptz,
  completed_by_member_id uuid references organization_members(id)
);

create index exception_containment_actions_exception_id_idx on exception_containment_actions(exception_id);
create index exception_containment_actions_organization_id_idx on exception_containment_actions(organization_id);

create trigger exception_containment_actions_set_department_id
  before insert on exception_containment_actions
  for each row
  execute function set_exception_child_department_id();

alter table exception_containment_actions enable row level security;

create policy exception_containment_actions_select on exception_containment_actions
  for select
  using (
    organization_id = current_org_id()
    and (
      owner_member_id = current_member_id()
      or has_scoped_permission('exceptions.view', department_id, null, null)
      or has_scoped_permission('exceptions.manage', department_id, null, null)
    )
  );

create policy exception_containment_actions_insert on exception_containment_actions
  for insert
  with check (
    organization_id = current_org_id()
    and (
      has_scoped_permission('exceptions.investigate', department_id, null, null)
      or has_scoped_permission('exceptions.manage', department_id, null, null)
    )
  );

create policy exception_containment_actions_update on exception_containment_actions
  for update
  using (
    organization_id = current_org_id()
    and (
      owner_member_id = current_member_id()
      or has_scoped_permission('exceptions.investigate', department_id, null, null)
      or has_scoped_permission('exceptions.manage', department_id, null, null)
    )
  )
  with check (
    organization_id = current_org_id()
    and (
      owner_member_id = current_member_id()
      or has_scoped_permission('exceptions.investigate', department_id, null, null)
      or has_scoped_permission('exceptions.manage', department_id, null, null)
    )
  );

revoke all on exception_containment_actions from anon, public, authenticated;
grant select, insert, update on exception_containment_actions to authenticated;

create table root_cause_analyses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  department_id uuid references departments(id),
  exception_id uuid not null references exceptions(id) on delete cascade,
  method text not null check (method in ('five_whys', 'fishbone', 'other')),
  fishbone_category text check (
    fishbone_category in ('people', 'process', 'equipment', 'materials', 'environment', 'management')
  ),
  primary_root_cause text,
  investigator_notes text,
  investigator_member_id uuid references organization_members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exception_id)
);

create index root_cause_analyses_organization_id_idx on root_cause_analyses(organization_id);

create trigger root_cause_analyses_set_department_id
  before insert on root_cause_analyses
  for each row
  execute function set_exception_child_department_id();

alter table root_cause_analyses enable row level security;

create policy root_cause_analyses_select on root_cause_analyses
  for select
  using (
    organization_id = current_org_id()
    and (
      has_scoped_permission('exceptions.view', department_id, null, null)
      or has_scoped_permission('exceptions.manage', department_id, null, null)
    )
  );

create policy root_cause_analyses_insert on root_cause_analyses
  for insert
  with check (
    organization_id = current_org_id()
    and (
      has_scoped_permission('exceptions.investigate', department_id, null, null)
      or has_scoped_permission('exceptions.manage', department_id, null, null)
    )
  );

create policy root_cause_analyses_update on root_cause_analyses
  for update
  using (
    organization_id = current_org_id()
    and (
      has_scoped_permission('exceptions.investigate', department_id, null, null)
      or has_scoped_permission('exceptions.manage', department_id, null, null)
    )
  )
  with check (
    organization_id = current_org_id()
    and (
      has_scoped_permission('exceptions.investigate', department_id, null, null)
      or has_scoped_permission('exceptions.manage', department_id, null, null)
    )
  );

revoke all on root_cause_analyses from anon, public, authenticated;
grant select, insert, update on root_cause_analyses to authenticated;

create table root_cause_factors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  root_cause_analysis_id uuid not null references root_cause_analyses(id) on delete cascade,
  factor_type text not null check (factor_type in ('five_why_step', 'secondary_root_cause', 'contributing_factor')),
  sequence_order integer not null default 0,
  description text not null,
  evidence_reference text,
  created_at timestamptz not null default now()
);

create index root_cause_factors_analysis_id_idx on root_cause_factors(root_cause_analysis_id);
create index root_cause_factors_organization_id_idx on root_cause_factors(organization_id);

alter table root_cause_factors enable row level security;

create policy root_cause_factors_select on root_cause_factors
  for select
  using (
    organization_id = current_org_id()
    and (has_scoped_permission('exceptions.view', null, null, null) or has_scoped_permission('exceptions.manage', null, null, null))
  );

create policy root_cause_factors_insert on root_cause_factors
  for insert
  with check (
    organization_id = current_org_id()
    and (has_scoped_permission('exceptions.investigate', null, null, null) or has_scoped_permission('exceptions.manage', null, null, null))
  );

create policy root_cause_factors_delete on root_cause_factors
  for delete
  using (
    organization_id = current_org_id()
    and (has_scoped_permission('exceptions.investigate', null, null, null) or has_scoped_permission('exceptions.manage', null, null, null))
  );

revoke all on root_cause_factors from anon, public, authenticated;
grant select, insert, delete on root_cause_factors to authenticated;

create table capa_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  department_id uuid references departments(id),
  exception_id uuid not null references exceptions(id) on delete cascade,
  title text not null,
  description text,
  owner_member_id uuid not null references organization_members(id),
  sponsor_member_id uuid references organization_members(id),
  completion_criteria text,
  effectiveness_check_method text,
  effectiveness_check_date date,
  verification_owner_member_id uuid references organization_members(id),
  status text not null default 'draft' check (
    status in (
      'draft', 'pending_approval', 'approved', 'in_progress', 'pending_verification',
      'effective', 'ineffective', 'closed', 'canceled', 'reopened'
    )
  ),
  created_at timestamptz not null default now(),
  created_by_member_id uuid references organization_members(id),
  closed_at timestamptz,
  closed_by_member_id uuid references organization_members(id)
);

create index capa_plans_exception_id_idx on capa_plans(exception_id);
create index capa_plans_organization_id_idx on capa_plans(organization_id);
create index capa_plans_status_idx on capa_plans(organization_id, status);

create trigger capa_plans_set_department_id
  before insert on capa_plans
  for each row
  execute function set_exception_child_department_id();

alter table capa_plans enable row level security;

create policy capa_plans_select on capa_plans
  for select
  using (
    organization_id = current_org_id()
    and (
      owner_member_id = current_member_id()
      or has_scoped_permission('capa.view', department_id, null, null)
      or has_scoped_permission('capa.edit', department_id, null, null)
    )
  );

create policy capa_plans_insert on capa_plans
  for insert
  with check (organization_id = current_org_id() and has_scoped_permission('capa.create', department_id, null, null));

create policy capa_plans_update on capa_plans
  for update
  using (
    organization_id = current_org_id()
    and (
      owner_member_id = current_member_id()
      or has_scoped_permission('capa.edit', department_id, null, null)
      or has_scoped_permission('capa.approve', department_id, null, null)
      or has_scoped_permission('capa.verify', department_id, null, null)
      or has_scoped_permission('capa.close', department_id, null, null)
    )
  )
  with check (
    organization_id = current_org_id()
    and (
      owner_member_id = current_member_id()
      or has_scoped_permission('capa.edit', department_id, null, null)
      or has_scoped_permission('capa.approve', department_id, null, null)
      or has_scoped_permission('capa.verify', department_id, null, null)
      or has_scoped_permission('capa.close', department_id, null, null)
    )
  );

revoke all on capa_plans from anon, public, authenticated;
grant select, insert, update on capa_plans to authenticated;

create table capa_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  department_id uuid references departments(id),
  capa_plan_id uuid not null references capa_plans(id) on delete cascade,
  action_type text not null check (action_type in ('corrective', 'preventive')),
  title text not null,
  description text,
  owner_member_id uuid not null references organization_members(id),
  due_at timestamptz,
  depends_on_action_id uuid references capa_actions(id),
  requires_evidence boolean not null default false,
  evidence_id uuid references evidence(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  created_by_member_id uuid references organization_members(id),
  completed_at timestamptz,
  completed_by_member_id uuid references organization_members(id)
);

create index capa_actions_plan_id_idx on capa_actions(capa_plan_id);
create index capa_actions_organization_id_idx on capa_actions(organization_id);
create index capa_actions_owner_member_id_idx on capa_actions(owner_member_id);

create or replace function set_capa_child_department_id()
returns trigger
language plpgsql
as $$
begin
  select department_id into new.department_id from capa_plans where id = new.capa_plan_id;
  return new;
end;
$$;

create trigger capa_actions_set_department_id
  before insert on capa_actions
  for each row
  execute function set_capa_child_department_id();

alter table capa_actions enable row level security;

create policy capa_actions_select on capa_actions
  for select
  using (
    organization_id = current_org_id()
    and (
      owner_member_id = current_member_id()
      or has_scoped_permission('capa.view', department_id, null, null)
      or has_scoped_permission('capa.edit', department_id, null, null)
    )
  );

create policy capa_actions_insert on capa_actions
  for insert
  with check (organization_id = current_org_id() and has_scoped_permission('capa.edit', department_id, null, null));

create policy capa_actions_update on capa_actions
  for update
  using (
    organization_id = current_org_id()
    and (owner_member_id = current_member_id() or has_scoped_permission('capa.edit', department_id, null, null))
  )
  with check (
    organization_id = current_org_id()
    and (owner_member_id = current_member_id() or has_scoped_permission('capa.edit', department_id, null, null))
  );

revoke all on capa_actions from anon, public, authenticated;
grant select, insert, update on capa_actions to authenticated;

create table capa_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  department_id uuid references departments(id),
  capa_plan_id uuid not null references capa_plans(id) on delete cascade,
  approver_member_id uuid not null references organization_members(id),
  decision text not null check (decision in ('approved', 'rejected')),
  comment text,
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index capa_approvals_plan_id_idx on capa_approvals(capa_plan_id);
create index capa_approvals_organization_id_idx on capa_approvals(organization_id);

create trigger capa_approvals_set_department_id
  before insert on capa_approvals
  for each row
  execute function set_capa_child_department_id();

alter table capa_approvals enable row level security;

create policy capa_approvals_select on capa_approvals
  for select
  using (
    organization_id = current_org_id()
    and (has_scoped_permission('capa.view', department_id, null, null) or has_scoped_permission('capa.edit', department_id, null, null))
  );

create policy capa_approvals_insert on capa_approvals
  for insert
  with check (organization_id = current_org_id() and has_scoped_permission('capa.approve', department_id, null, null));

revoke all on capa_approvals from anon, public, authenticated;
grant select, insert on capa_approvals to authenticated;

create table capa_effectiveness_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  department_id uuid references departments(id),
  capa_plan_id uuid not null references capa_plans(id) on delete cascade,
  checked_at timestamptz not null default now(),
  outcome text not null check (outcome in ('effective', 'ineffective')),
  notes text,
  verifier_member_id uuid not null references organization_members(id),
  created_at timestamptz not null default now()
);

create index capa_effectiveness_checks_plan_id_idx on capa_effectiveness_checks(capa_plan_id);
create index capa_effectiveness_checks_organization_id_idx on capa_effectiveness_checks(organization_id);

create trigger capa_effectiveness_checks_set_department_id
  before insert on capa_effectiveness_checks
  for each row
  execute function set_capa_child_department_id();

alter table capa_effectiveness_checks enable row level security;

create policy capa_effectiveness_checks_select on capa_effectiveness_checks
  for select
  using (
    organization_id = current_org_id()
    and (has_scoped_permission('capa.view', department_id, null, null) or has_scoped_permission('capa.edit', department_id, null, null))
  );

create policy capa_effectiveness_checks_insert on capa_effectiveness_checks
  for insert
  with check (organization_id = current_org_id() and has_scoped_permission('capa.verify', department_id, null, null));

revoke all on capa_effectiveness_checks from anon, public, authenticated;
grant select, insert on capa_effectiveness_checks to authenticated;

create table temporary_waivers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  department_id uuid references departments(id),
  exception_id uuid not null references exceptions(id) on delete cascade,
  business_justification text not null,
  compensating_controls text,
  risk_acceptance text,
  requested_by_member_id uuid references organization_members(id),
  approver_member_id uuid references organization_members(id),
  status text not null default 'requested' check (
    status in ('requested', 'approved', 'rejected', 'active', 'renewed', 'revoked', 'expired')
  ),
  start_at timestamptz,
  -- Required, not optional — a waiver "must never silently become
  -- permanent" (this phase's requirement), so there is always a
  -- concrete expiration to renew or let lapse.
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index temporary_waivers_exception_id_idx on temporary_waivers(exception_id);
create index temporary_waivers_organization_id_idx on temporary_waivers(organization_id);
create index temporary_waivers_expires_at_idx on temporary_waivers(expires_at) where status in ('approved', 'active', 'renewed');

create trigger temporary_waivers_set_department_id
  before insert on temporary_waivers
  for each row
  execute function set_exception_child_department_id();

alter table temporary_waivers enable row level security;

create policy temporary_waivers_select on temporary_waivers
  for select
  using (
    organization_id = current_org_id()
    and (has_scoped_permission('waivers.view', department_id, null, null) or has_scoped_permission('waivers.manage', department_id, null, null))
  );

create policy temporary_waivers_insert on temporary_waivers
  for insert
  with check (organization_id = current_org_id() and has_scoped_permission('waivers.create', department_id, null, null));

create policy temporary_waivers_update on temporary_waivers
  for update
  using (
    organization_id = current_org_id()
    and (
      has_scoped_permission('waivers.approve', department_id, null, null)
      or has_scoped_permission('waivers.manage', department_id, null, null)
    )
  )
  with check (
    organization_id = current_org_id()
    and (
      has_scoped_permission('waivers.approve', department_id, null, null)
      or has_scoped_permission('waivers.manage', department_id, null, null)
    )
  );

revoke all on temporary_waivers from anon, public, authenticated;
grant select, insert, update on temporary_waivers to authenticated;

create table waiver_approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  department_id uuid references departments(id),
  waiver_id uuid not null references temporary_waivers(id) on delete cascade,
  approver_member_id uuid not null references organization_members(id),
  decision text not null check (decision in ('approved', 'rejected')),
  comment text,
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index waiver_approvals_waiver_id_idx on waiver_approvals(waiver_id);
create index waiver_approvals_organization_id_idx on waiver_approvals(organization_id);

create or replace function set_waiver_child_department_id()
returns trigger
language plpgsql
as $$
begin
  select department_id into new.department_id from temporary_waivers where id = new.waiver_id;
  return new;
end;
$$;

create trigger waiver_approvals_set_department_id
  before insert on waiver_approvals
  for each row
  execute function set_waiver_child_department_id();

alter table waiver_approvals enable row level security;

create policy waiver_approvals_select on waiver_approvals
  for select
  using (
    organization_id = current_org_id()
    and (has_scoped_permission('waivers.view', department_id, null, null) or has_scoped_permission('waivers.manage', department_id, null, null))
  );

create policy waiver_approvals_insert on waiver_approvals
  for insert
  with check (organization_id = current_org_id() and has_scoped_permission('waivers.approve', department_id, null, null));

revoke all on waiver_approvals from anon, public, authenticated;
grant select, insert on waiver_approvals to authenticated;

create table waiver_renewals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  department_id uuid references departments(id),
  waiver_id uuid not null references temporary_waivers(id) on delete cascade,
  previous_expires_at timestamptz not null,
  new_expires_at timestamptz not null,
  requested_by_member_id uuid references organization_members(id),
  approved_by_member_id uuid references organization_members(id),
  created_at timestamptz not null default now()
);

create index waiver_renewals_waiver_id_idx on waiver_renewals(waiver_id);
create index waiver_renewals_organization_id_idx on waiver_renewals(organization_id);

create trigger waiver_renewals_set_department_id
  before insert on waiver_renewals
  for each row
  execute function set_waiver_child_department_id();

alter table waiver_renewals enable row level security;

create policy waiver_renewals_select on waiver_renewals
  for select
  using (
    organization_id = current_org_id()
    and (has_scoped_permission('waivers.view', department_id, null, null) or has_scoped_permission('waivers.manage', department_id, null, null))
  );

create policy waiver_renewals_insert on waiver_renewals
  for insert
  with check (
    organization_id = current_org_id()
    and (has_scoped_permission('waivers.approve', department_id, null, null) or has_scoped_permission('waivers.manage', department_id, null, null))
  );

revoke all on waiver_renewals from anon, public, authenticated;
grant select, insert on waiver_renewals to authenticated;

-- Logged, queryable heuristic matches — not a live-computed view, so a
-- past match remains visible even if the matched exception's own
-- attributes later change. Populated by exceptions.ts's
-- findRecurrenceMatches() at creation time; a plain heuristic (same
-- process/department/location/exception_type, or tag overlap, within a
-- configurable lookback window) — explicitly not a duplicate-detection
-- guarantee, per this phase's requirement not to claim one.
create table recurrence_matches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  exception_id uuid not null references exceptions(id) on delete cascade,
  matched_exception_id uuid not null references exceptions(id) on delete cascade,
  match_basis jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (exception_id, matched_exception_id)
);

create index recurrence_matches_exception_id_idx on recurrence_matches(exception_id);
create index recurrence_matches_organization_id_idx on recurrence_matches(organization_id);

alter table recurrence_matches enable row level security;

create policy recurrence_matches_select on recurrence_matches
  for select
  using (
    organization_id = current_org_id()
    and (has_scoped_permission('exceptions.view', null, null, null) or has_scoped_permission('exceptions.manage', null, null, null))
  );

create policy recurrence_matches_insert on recurrence_matches
  for insert
  with check (organization_id = current_org_id());

revoke all on recurrence_matches from anon, public, authenticated;
grant select, insert on recurrence_matches to authenticated;

-- New Phase 11 permissions — replaces the coarse exception.create/
-- exception.manage placeholder rows the permissions matrix reserved
-- since Phase 0 (never referenced by any migration or service until
-- now) with the finer-grained set this phase's requirements call for.
delete from role_permissions where permission_id in (
  select id from permissions where key in ('exception.create', 'exception.manage')
);
delete from permissions where key in ('exception.create', 'exception.manage');

insert into permissions (key, description) values
  ('exceptions.view', 'View exceptions within scope.'),
  ('exceptions.create', 'Flag or record a new exception.'),
  ('exceptions.edit', 'Edit an exception''s details, links, and containment actions.'),
  ('exceptions.triage', 'Set severity/priority, assign an owner, and change status through triage.'),
  ('exceptions.investigate', 'Record root-cause analysis and containment actions.'),
  ('exceptions.close', 'Close, reject, or reopen an exception.'),
  ('exceptions.manage', 'Full administrative control over exceptions in scope.'),
  ('capa.view', 'View CAPA plans within scope.'),
  ('capa.create', 'Create a CAPA plan against an exception.'),
  ('capa.edit', 'Edit a CAPA plan and its actions.'),
  ('capa.approve', 'Approve or reject a CAPA plan.'),
  ('capa.verify', 'Record a CAPA effectiveness check.'),
  ('capa.close', 'Close or cancel a CAPA plan.'),
  ('waivers.view', 'View temporary waivers within scope.'),
  ('waivers.create', 'Request a temporary waiver against an exception.'),
  ('waivers.approve', 'Approve, reject, renew, or revoke a temporary waiver.'),
  ('waivers.manage', 'Full administrative control over waivers in scope.');

insert into role_permissions (role_id, permission_id, scope)
select r.id, p.id, v.scope
from (values
  ('organization_admin', 'exceptions.view', null),
  ('organization_admin', 'exceptions.create', null),
  ('organization_admin', 'exceptions.edit', null),
  ('organization_admin', 'exceptions.triage', null),
  ('organization_admin', 'exceptions.investigate', null),
  ('organization_admin', 'exceptions.close', null),
  ('organization_admin', 'exceptions.manage', null),
  ('organization_admin', 'capa.view', null),
  ('organization_admin', 'capa.create', null),
  ('organization_admin', 'capa.edit', null),
  ('organization_admin', 'capa.approve', null),
  ('organization_admin', 'capa.verify', null),
  ('organization_admin', 'capa.close', null),
  ('organization_admin', 'waivers.view', null),
  ('organization_admin', 'waivers.create', null),
  ('organization_admin', 'waivers.approve', null),
  ('organization_admin', 'waivers.manage', null),
  ('process_owner', 'exceptions.view', 'scoped'),
  ('process_owner', 'exceptions.create', 'scoped'),
  ('process_owner', 'exceptions.edit', 'scoped'),
  ('process_owner', 'exceptions.triage', 'scoped'),
  ('process_owner', 'exceptions.investigate', 'scoped'),
  ('process_owner', 'exceptions.close', 'scoped'),
  ('process_owner', 'capa.view', 'scoped'),
  ('process_owner', 'capa.create', 'scoped'),
  ('process_owner', 'capa.edit', 'scoped'),
  ('process_owner', 'capa.approve', 'scoped'),
  ('process_owner', 'capa.verify', 'scoped'),
  ('process_owner', 'capa.close', 'scoped'),
  ('process_owner', 'waivers.view', 'scoped'),
  ('process_owner', 'waivers.create', 'scoped'),
  ('process_owner', 'waivers.approve', 'scoped'),
  ('manager', 'exceptions.view', 'scoped'),
  ('manager', 'exceptions.create', 'scoped'),
  ('manager', 'exceptions.edit', 'scoped'),
  ('manager', 'exceptions.triage', 'scoped'),
  ('manager', 'exceptions.investigate', 'scoped'),
  ('manager', 'capa.view', 'scoped'),
  ('manager', 'capa.create', 'scoped'),
  ('manager', 'capa.edit', 'scoped'),
  ('manager', 'waivers.view', 'scoped'),
  ('manager', 'waivers.create', 'scoped'),
  ('employee', 'exceptions.create', null),
  ('employee', 'waivers.view', 'scoped'),
  ('auditor', 'exceptions.view', 'scoped'),
  ('auditor', 'capa.view', 'scoped'),
  ('auditor', 'waivers.view', 'scoped')
) as v(role_key, permission_key, scope)
join roles r on r.key = v.role_key and r.organization_id is null
join permissions p on p.key = v.permission_key;
