# Feature Catalog

Organized by [product-loop](vision.md) stage. Status reflects the current
phase (see [phase tracker](../docs/project/phase-tracker.md)) — this
catalog documents intended scope; it does not imply any feature listed
here is implemented yet.

## 1. Knowledge import

- Document upload (PDF, DOCX, plain text) with metadata (owner, category,
  scope).
- Manual authoring of knowledge documents in-app.
- Document versioning with full history and diff between versions.
- AI-assisted document comparison to surface material changes between
  versions.

## 2. Knowledge governance

- Ownership assignment per document.
- Review workflow (draft → in review → published).
- Access scoping by location, department, or role.
- Search across the knowledge base, scoped to what the searcher can view.

## 3. Process authoring

- AI-assisted extraction of proposed process steps from source knowledge
  documents (always a draft, never auto-published).
- Manual process authoring and editing (steps, roles, forms, approvals,
  evidence requirements, branching).
- Process templates for common patterns (checklist, approval chain,
  incident response).

## 4. Process governance

- Review and publish workflow mirroring knowledge governance.
- Immutable, versioned publication — every published process version is
  permanently retrievable.
- Ownership and accountability tracking per process.

## 5. Workflow execution

- Manual start (on demand), scheduled start (recurring), and triggered
  start (event-based) for workflows.
- Assignment to individuals, teams, locations, or roles.
- Task sequencing: linear, parallel, and conditional branches.
- Deadlines and automatic escalation on breach.

## 6. Forms and evidence

- Configurable form fields attached to process steps (text, number,
  choice, file, signature, photo).
- Evidence upload with metadata (who, when, geotag where relevant).
- Form submission history tied to the workflow instance that produced it.

## 7. Approvals

- Configurable approval steps with named or role-based approvers.
- Multi-step and multi-party approval chains.
- Approval decisions recorded with timestamp, actor, and optional comment.

## 8. Exception management

- Automatic exception creation on deadline breach, failed check, or
  rejected approval.
- Manual exception flagging by any permitted role.
- Triage queue with severity and ownership assignment.
- Corrective-action tracking through to closure, linked back to the
  originating exception.

## 9. Training and certification

- Course authoring/import, with content and optional assessment.
- Assignment rules tied to role, department, or individual.
- Completion tracking and reminders.
- Certification issuance with expiry and renewal tracking.

## 10. Analytics

- Per-process dashboards: completion rate, cycle time, exception rate.
- Cross-process/organization dashboards for operations leaders.
- Training compliance dashboards.
- Trend views over time, scoped by location/department.

## 11. Audit and compliance

- Immutable audit event log covering publish, approval, exception
  resolution, permission changes, and access to sensitive records.
- Filtered, scoped audit views by role.
- Export for external audit/compliance use.

## 12. AI copilot (governed)

- Draft process step extraction from knowledge sources.
- Question answering grounded in approved organizational sources only.
- Draft training content generation.
- Document version comparison and summarization.
- Exception summarization for managers/compliance.
- Process improvement suggestions grounded in real exception/analytics
  history.

All AI capabilities operate within the boundaries defined in
[AI architecture](../docs/architecture/ai-architecture.md) — assistive
only, never independently authoritative.

## 13. People and organization administration

- Member invitation and lifecycle management.
- Role assignment, including custom roles bounded by
  [permissions matrix](permissions-matrix.md) rules.
- Location, department, and team management.
- Organization settings and branding.

## 14. Billing and entitlements

- Subscription plan management (Stripe-backed).
- Seat and usage-based entitlement enforcement.
- Self-serve plan changes for `organization_owner`.

## 15. Integrations

- Provider-neutral adapters for identity, storage, email, and background
  jobs so the underlying provider can change without a product rewrite.
- Organization-configurable integration settings, admin-only.

## 16. External portal

- Resource-scoped access for `external_user` — a single task, form, or
  approval, without standing organizational access.

## 17. Notifications

- Email (and later, additional channel) notifications for assignments,
  approvals, deadlines, and exceptions, via a provider-neutral email
  adapter.

## Related documents

- [Vision](vision.md)
- [Requirements](requirements.md)
- [Roadmap](roadmap.md)
- [Phase tracker](../docs/project/phase-tracker.md)
