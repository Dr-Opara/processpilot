# Production-Safe SaaS Demo Workspace (Phase 28)

A single, explicitly-flagged organization (`organizations.is_demo`) used
for sales and prospect walkthroughs of the real product — not a separate
demo build, not a mock UI. It is an ordinary tenant in every respect
(same tables, same RLS, same multi-tenancy rules) except for the one flag
and the external-side-effect guards it triggers.

## The flag

`organizations.is_demo boolean not null default false`, with a unique
index on the column filtered to `true` rows
(`organizations_single_demo_idx`) enforcing at most one demo organization
at a time — a second attempt to flag an organization fails with a clear
`409 conflict`, not a silent second demo tenant.

Only a platform admin (Phase 27) can flag/unflag an organization as demo
or reset its content —
`src/lib/services/demo-workspace.ts`'s `markOrganizationAsDemo()`,
`unmarkOrganizationAsDemo()`, `resetDemoWorkspace()`,
`seedDemoWorkspaceContent()`. UI: the "Demo workspace" section on
`/app/platform-admin/organizations/[organizationId]`.

## Seeded content

`seedDemoWorkspaceContent()` idempotently upserts a small, clearly
synthetic baseline — 2 departments, 1 location, 1 published knowledge
document, 1 published process (a 3-node start → human task → end graph)
— matching `scripts/seed-dev-data.mjs`'s existing "small, obviously
fictional fixture, matched by natural key" convention rather than
inventing a second seeding style. It's guarded to organizations actually
flagged `is_demo`, so a wrong id can never seed synthetic content into a
real customer's tenant. Members, departments beyond the seeded two, and
anything a demo visitor creates by clicking around are left alone.

**Known gap:** resetting restores this baseline only — it does not purge
ad-hoc content (workflows/tasks/exceptions/etc.) a demo session may have
created. Safely wiping every organization-scoped table without a
dedicated cascade-delete security review is exactly the risk Phase 21's
organization-deletion finalization was deliberately deferred for (see
[organization-administration.md](organization-administration.md)'s known
gaps) — this phase doesn't attempt to build that review-gated mechanism
either. A future pass that wants a true full-content reset should treat
this the same way: a dedicated review before anything deletes broadly by
`organization_id`, not a quick addition here.

## No real external actions

The demo workspace must never send a real email, deliver a real webhook,
call a real AI provider, or touch real Stripe billing. `src/lib/demo.ts`'s
`isDemoOrganization()` is the single check point; every external-call
site applies it explicitly rather than relying on an implicit guard:

- **Email** (`src/lib/jobs/notification-handlers.ts`) — a delivery for
  the demo organization is marked `skipped_demo_workspace` (a new
  `notification_deliveries.status` value, added in this phase's
  migration alongside `skipped_not_configured`/`skipped_preference`)
  before `isEmailConfigured()` is even checked.
- **Webhooks** (`src/lib/jobs/webhook-handlers.ts`) — a delivery for the
  demo organization is marked `dead_letter` with a clear reason before
  the target URL is ever fetched.
- **AI copilot** (`src/lib/services/ai-settings.ts`'s
  `isAiCopilotEnabledForOrg()`) — returns `false` for the demo
  organization regardless of a real credential or the org's own flag
  value, gating all six AI capabilities at their one shared choke point.
- **Billing** (`src/lib/services/billing.ts`) — `createCheckoutSessionUrl()`
  and `createBillingPortalUrl()` both throw before reaching the real
  Stripe adapter. `cancelCurrentSubscription()` needs no separate guard:
  a demo organization can never have a real subscription in the first
  place (checkout is blocked), so it always fails at the existing
  "no active subscription" check first.

## UI

- **`DemoModeBanner`** (`src/components/app/DemoModeBanner.tsx`) —
  server-rendered, shown in the protected app shell
  (`src/app/app/(protected)/layout.tsx`) whenever the current member's
  organization is flagged demo. A factual disclosure, not a dismissible
  preference.
- **`DemoGuidedTour`** (`src/components/app/DemoGuidedTour.tsx`) — a
  small, dismissible checklist on the dashboard
  (`src/app/app/(protected)/page.tsx`) pointing at the seeded content.
  Dismissal is `localStorage`-only; there is no server-side "tour
  completed" state.

## Known gaps

- No purge of ad-hoc demo-session content on reset (see "Seeded content"
  above).
- No public, unauthenticated self-serve demo access — a prospect
  currently needs a real Clerk membership in the demo organization
  (added the same way any customer member is invited). Building
  anonymous, auth-less viewing is a materially larger feature (its own
  security model) and was scoped out of this pass.
- No scheduled/automatic reset — `resetDemoWorkspace()` is
  platform-admin-triggered only in this pass; wiring it to a recurring
  background job is straightforward future work (the existing
  Vercel-cron-triggered worker, see
  [observability.md](observability.md)) but wasn't added here to avoid
  an unreviewed content wipe running unattended.

## Related documents

- [Internal support and platform administration](platform-administration.md)
- [Organization administration](organization-administration.md)
- [AI architecture](ai-architecture.md)
- [Billing architecture](billing-architecture.md)
- [Notifications](notifications.md)
