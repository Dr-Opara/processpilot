-- Phase 13 (AI ingestion and copilot): the provider-neutral AI adapter's
-- persistence layer, per docs/architecture/ai-architecture.md's
-- governance boundary — AI may draft and suggest but never
-- independently publish, approve, close, or certify.
--
-- Two tables:
-- 1. ai_drafts — every AI-generated draft/suggestion the adapter
--    produces (process-step extraction, training-content drafts,
--    process-improvement suggestions, exception summaries, document-
--    comparison summaries, grounded Q&A answers), each starting
--    'pending' and requiring an explicit human action
--    (acceptAiDraft()/dismissAiDraft() in src/lib/services/ai-drafts.ts)
--    to be marked accepted — accepting a draft never itself performs
--    the governed mutation (publish/approve/close/certify); it only
--    records that a human chose to act on this draft when they
--    separately called the real mutation (process.publish,
--    approval.review, exceptions.close, ...). No table or trigger here
--    can call those mutations — the governance boundary is structural
--    (no AI service module imports a publish/approve/close/certify
--    function), not merely documented.
-- 2. ai_usage_events — one row per adapter call (token counts, model,
--    feature, latency), independent of whether that call produced a
--    persisted draft (e.g. a Q&A answer is usage-tracked even though
--    the answer itself isn't necessarily kept as a draft) — the "token
--    and usage tracking" requirement, and the natural place to notice
--    runaway cost/usage per organization later.
--
-- Neither table persists a raw system/user prompt string long-term —
-- only prompt_summary (a short, non-sensitive description of what was
-- asked, e.g. "Q&A: <question text, already tenant-scoped data>") and
-- the structured output. The organization's own data isn't materially
-- more sensitive stored here than it already is in the source records
-- (document/process/exception) it was grounded against, and both
-- tables carry the same RLS/tenant-isolation posture as everything
-- else — this isn't a shared cross-tenant log.

create table ai_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  department_id uuid references departments(id),
  draft_type text not null check (
    draft_type in (
      'process_extraction', 'training_content', 'process_improvement',
      'exception_summary', 'document_comparison', 'qa_answer'
    )
  ),
  -- Polymorphic reference to the record this draft was grounded
  -- against (knowledge_document/process/exception/training_course/...)
  -- — no FK, validated at the service layer, same pattern
  -- exception_links established for a reference that can point at more
  -- than one table.
  source_type text,
  source_id uuid,
  prompt_summary text not null,
  -- { answer?, citations?: [{documentId, versionId, title}], steps?, ... }
  -- — shape depends on draft_type; see each ai-*.ts service for its
  -- own schema.
  output jsonb not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'dismissed')),
  -- Purely informational — what the human went on to create/change
  -- after accepting, so the audit trail can show "this published
  -- process version originated from this AI draft" without the draft
  -- table itself having any power to cause that change.
  accepted_resource_type text,
  accepted_resource_id uuid,
  decided_at timestamptz,
  decided_by uuid references organization_members(id),
  created_at timestamptz not null default now(),
  created_by uuid references organization_members(id)
);

create index ai_drafts_organization_id_idx on ai_drafts(organization_id);
create index ai_drafts_status_idx on ai_drafts(organization_id, status);
create index ai_drafts_source_idx on ai_drafts(source_type, source_id) where source_id is not null;

alter table ai_drafts enable row level security;

create policy ai_drafts_select on ai_drafts
  for select
  using (organization_id = current_org_id() and has_scoped_permission('ai.use', department_id, null, null));

create policy ai_drafts_insert on ai_drafts
  for insert
  with check (organization_id = current_org_id() and has_scoped_permission('ai.use', department_id, null, null));

create policy ai_drafts_update on ai_drafts
  for update
  using (organization_id = current_org_id() and has_scoped_permission('ai.use', department_id, null, null))
  with check (organization_id = current_org_id() and has_scoped_permission('ai.use', department_id, null, null));

revoke all on ai_drafts from anon, public, authenticated;
grant select, insert, update on ai_drafts to authenticated;

create table ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  feature text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  ai_draft_id uuid references ai_drafts(id),
  created_at timestamptz not null default now(),
  created_by uuid references organization_members(id)
);

create index ai_usage_events_organization_id_idx on ai_usage_events(organization_id);
create index ai_usage_events_created_at_idx on ai_usage_events(organization_id, created_at);

alter table ai_usage_events enable row level security;

create policy ai_usage_events_select on ai_usage_events
  for select
  using (organization_id = current_org_id() and has_scoped_permission('ai.configure', null, null, null));

-- Recorded unconditionally alongside every adapter call (by whichever
-- ai-*.ts service made it) — no separate permission gate beyond tenant
-- match, since the call that produced this usage row already checked
-- ai.use before reaching here, same posture as every other
-- append-only side-effect table (task_history, escalation_events, ...).
create policy ai_usage_events_insert on ai_usage_events
  for insert
  with check (organization_id = current_org_id());

revoke all on ai_usage_events from anon, public, authenticated;
grant select, insert on ai_usage_events to authenticated;
