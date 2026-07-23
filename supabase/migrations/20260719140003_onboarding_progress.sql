-- Phase 5: resumable company-onboarding wizard state. Lives on
-- organization_settings (already the 1:1 "infrequently-read
-- configuration" extension of organizations, per its own Phase 4 header
-- comment) rather than a new table, since this is a single row of
-- progress per organization, not a growing history.

alter table organization_settings
  add column onboarding_step text not null default 'welcome' check (
    onboarding_step in (
      'welcome',
      'company_profile',
      'locations',
      'departments',
      'teams',
      'invite_employees',
      'review',
      'finished'
    )
  ),
  add column onboarding_completed_at timestamptz,
  add column onboarding_data jsonb not null default '{}'::jsonb;

-- Company-profile fields onboarding collects beyond what organizations/
-- organization_settings already had (name, timezone, locale). Kept as
-- real columns rather than folded into the jsonb `settings` bag because
-- they're read structurally elsewhere (e.g. legal_name on invoices in a
-- later billing phase), matching this table's existing column-vs-jsonb
-- split.
alter table organizations
  add column legal_name text,
  add column industry text,
  add column employee_count_range text,
  add column website_url text,
  add column country text,
  add column primary_use_case text,
  add column logo_url text;

alter table organization_settings
  add column date_format text not null default 'YYYY-MM-DD',
  add column week_start text not null default 'monday' check (week_start in ('sunday', 'monday'));
