-- Phase 28 (Production-safe SaaS demo workspace): a single,
-- explicitly-flagged organization used for sales/prospect walkthroughs.
-- Everything about this organization is otherwise an ordinary tenant —
-- same RLS, same tables, same multi-tenancy rules — the only new
-- surface is the `is_demo` flag itself and the platform-admin actions
-- that read it (src/lib/services/demo-workspace.ts).

alter table organizations add column is_demo boolean not null default false;

-- At most one demo organization at a time: a unique index on a
-- single boolean column, filtered to true rows, blocks a second row
-- from ever being flagged demo while one already exists.
create unique index organizations_single_demo_idx on organizations (is_demo) where is_demo;

-- Extend notification_deliveries' status check constraint with
-- 'skipped_demo_workspace', alongside the existing
-- 'skipped_not_configured'/'skipped_preference' skip reasons (Phase 16)
-- — the demo workspace must never send a real email, the same "fail
-- safe, never fake success" posture every other skip reason already
-- uses.
alter table notification_deliveries drop constraint notification_deliveries_status_check;
alter table notification_deliveries add constraint notification_deliveries_status_check
  check (status in (
    'pending', 'sent', 'failed', 'skipped_not_configured', 'skipped_preference',
    'skipped_demo_workspace'
  ));
