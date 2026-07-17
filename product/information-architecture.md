# Information Architecture

ProcessPilot has two distinct properties with different audiences,
navigation models, and deployment targets.

## Marketing site — processpilot.com

Public, unauthenticated, SEO-relevant. Built for prospective buyers moving
from awareness to trial/demo request.

- **Home** — value proposition, product loop summary, primary CTAs (Start
  trial, Request demo).
- **Product** — feature depth by product-loop stage (knowledge, process,
  workflow, evidence, training, analytics, audit).
- **Solutions** — cross-cutting use cases (compliance, quality management,
  onboarding, franchise operations).
- **Industries** — vertical-specific framing (healthcare, manufacturing,
  food service, field services, financial services).
- **Pricing** — plan tiers and what's included; see
  [pricing hypotheses](pricing-hypotheses.md) (directional, not committed
  pricing).
- **Security** — trust content: multi-tenancy model, data handling, SOC 2 /
  compliance posture as it becomes real (never fabricated — see
  [product principles](product-principles.md)).
- **Resources** — guides, docs, and (later) blog/case studies.
- **Company** — about, careers, contact.
- **Request demo** — lead-capture flow to sales.
- **Start trial** — self-serve signup flow into the authenticated app.
- **Sign in** — entry point into app.processpilot.com.
- **Privacy** / **Terms** — legal.

## Authenticated application — app.processpilot.com

Role-aware; navigation and content adapt to the signed-in member's
permissions (see [permissions matrix](permissions-matrix.md)). No
navigation item is ever the _only_ thing preventing unauthorized access —
server-side checks are authoritative.

- **Home** — personalized landing: what's assigned to me, what needs my
  attention, organization-level highlights if permitted.
- **My Work** — the employee-centric hub: assigned tasks, forms to submit,
  approvals awaiting me, training due.
- **Processes** — process catalog: view, create, edit, review, publish
  (visible extent depends on `process.*` permissions).
- **Knowledge** — knowledge document library: source documents, versions,
  review status.
- **Training** — course catalog, assignments, certifications (own or
  managed, depending on `training.*` permissions).
- **Approvals** — pending and historical approval decisions within scope.
- **Exceptions** — exception queue and corrective-action tracking.
- **Analytics** — dashboards: completion, cycle time, exception rate,
  training compliance, scoped to what `analytics.view` permits.
- **Audit** — audit event log and export, scoped to `audit.view` /
  `audit.export`.
- **Integrations** — configured third-party connections (admin-only by
  default).
- **People** — member directory, roles, locations, departments, teams
  (admin/manager-scoped).
- **Settings** — organization settings, billing, security, branding.

## Role-aware navigation behavior

- Navigation items with zero permitted actions for the current member are
  hidden, not shown-disabled — reduces confusion for roles like `employee`
  or `external_user` with narrow scope.
- `external_user` sessions render a minimal, resource-specific shell (the
  one assigned task/form/approval), not the full application chrome.
- `auditor` sessions render read-only equivalents of standard views;
  destructive or state-changing controls are never rendered for a session
  that structurally cannot use them.
- Admin-only sections (**People**, **Integrations**, billing under
  **Settings**) are omitted entirely for roles without the corresponding
  `*.manage` permission, rather than shown and then blocked on click.

## Related documents

- [User roles](user-roles.md)
- [Permissions matrix](permissions-matrix.md)
- [Marketing layout](../design/marketing-layout.md)
- [Application layout](../design/application-layout.md)
