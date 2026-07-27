-- Phase 16 (Notifications): in-app notification feed, per-channel
-- delivery tracking, and per-member/org-default notification
-- preferences. See docs/architecture/notifications.md.

create table notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  department_id uuid references departments(id),
  recipient_member_id uuid not null references organization_members(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text not null,
  resource_type text,
  resource_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_idx
  on notifications(recipient_member_id, created_at desc);
create index notifications_organization_id_idx on notifications(organization_id);

alter table notifications enable row level security;

-- Own-resource only, same "recipient reads their own feed" scope every
-- other personal-inbox-style table in this app uses (e.g. training
-- assignments' assignee-scoped select). No broader admin browsing view
-- exists yet — an admin who needs to see what a member was notified
-- about goes through the audit log instead.
create policy notifications_select on notifications
  for select
  using (organization_id = current_org_id() and recipient_member_id = current_member_id());

-- Marking read is the only mutation an end user makes; row creation is
-- exclusively createNotification() (src/lib/services/notifications.ts),
-- called from within an already permission-checked transaction — same
-- "insert-only, trusted caller" posture as audit_events_insert.
create policy notifications_update on notifications
  for update
  using (organization_id = current_org_id() and recipient_member_id = current_member_id())
  with check (organization_id = current_org_id() and recipient_member_id = current_member_id());

create policy notifications_insert on notifications
  for insert
  with check (organization_id = current_org_id());

revoke all on notifications from anon, public, authenticated;
grant select, insert, update on notifications to authenticated;

-- notification_deliveries: one row per (notification, channel) delivery
-- attempt record — separate from `notifications` because a channel's
-- delivery status (pending/sent/failed/skipped) is operational state a
-- background job owns, distinct from the notification content and
-- read/unread state a recipient owns. Written exclusively by the admin
-- client from within the deliver-notification-email job handler
-- (src/lib/jobs/notification-handlers.ts) — no insert/update grant to
-- the authenticated role at all, mirroring webhook_events.
create table notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references notifications(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  channel text not null default 'email' check (channel in ('email')),
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'skipped_not_configured', 'skipped_preference')),
  provider_message_id text,
  error_message text,
  attempt_count int not null default 0,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index notification_deliveries_notification_idx on notification_deliveries(notification_id);
create index notification_deliveries_organization_id_idx on notification_deliveries(organization_id);
create index notification_deliveries_status_idx on notification_deliveries(status)
  where status = 'pending';

alter table notification_deliveries enable row level security;

-- Read-only visibility for the same audience that can see the audit
-- log — delivery status is an operational/compliance concern ("did this
-- alert actually go out"), not a personal-inbox one.
create policy notification_deliveries_select on notification_deliveries
  for select
  using (organization_id = current_org_id() and has_permission('audit.view'));

revoke all on notification_deliveries from anon, public, authenticated;
grant select on notification_deliveries to authenticated;

-- notification_preferences: member_id null = the organization default
-- for that notification_type; a non-null row is a specific member's
-- override. Two partial unique indexes (rather than one plain unique
-- constraint) because Postgres treats every NULL as distinct under a
-- normal unique constraint, which would allow unlimited duplicate
-- org-default rows for the same type.
create table notification_preferences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  member_id uuid references organization_members(id) on delete cascade,
  notification_type text not null,
  email_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index notification_preferences_org_default_idx
  on notification_preferences(organization_id, notification_type)
  where member_id is null;
create unique index notification_preferences_member_idx
  on notification_preferences(organization_id, member_id, notification_type)
  where member_id is not null;

create trigger notification_preferences_set_updated_at
  before update on notification_preferences
  for each row execute function set_updated_at();

alter table notification_preferences enable row level security;

-- A member reads/writes only their own override rows, plus can read
-- (never write) the organization-default rows so the UI can show what
-- they'd fall back to. Writing an organization-default row requires
-- organization.settings — the existing "edit organization-wide
-- configuration" permission, reused rather than inventing a narrower
-- one for this single setting category.
create policy notification_preferences_select on notification_preferences
  for select
  using (organization_id = current_org_id() and (member_id = current_member_id() or member_id is null));

create policy notification_preferences_insert on notification_preferences
  for insert
  with check (
    organization_id = current_org_id()
    and (
      member_id = current_member_id()
      or (member_id is null and has_permission('organization.settings'))
    )
  );

create policy notification_preferences_update on notification_preferences
  for update
  using (
    organization_id = current_org_id()
    and (
      member_id = current_member_id()
      or (member_id is null and has_permission('organization.settings'))
    )
  )
  with check (
    organization_id = current_org_id()
    and (
      member_id = current_member_id()
      or (member_id is null and has_permission('organization.settings'))
    )
  );

revoke all on notification_preferences from anon, public, authenticated;
grant select, insert, update on notification_preferences to authenticated;
