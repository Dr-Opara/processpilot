# Requirements

High-level functional and non-functional requirements for ProcessPilot as
a commercial product. Feature-level detail lives in the
[feature catalog](feature-catalog.md); this document sets the bar every
feature must clear.

## Functional requirements (by product-loop stage)

| Stage                | Must support                                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Import knowledge     | Uploading documents (PDF, DOCX, plain text at minimum); manual authoring; versioning on edit.                    |
| Structure & govern   | Ownership assignment, review status, categorization, access scoping.                                             |
| Draft process        | AI-assisted extraction of structured steps from source knowledge, always presented as an editable draft.         |
| Review & publish     | Explicit human review and publish action; immutable published versions; full version history.                    |
| Assign & execute     | Assigning a published process to individuals, teams, locations, or on a schedule; generating tasks.              |
| Approvals & evidence | Configurable approval steps; file/photo/signature evidence capture attached to tasks.                            |
| Exceptions           | Automatic and manual exception creation; triage workflow; corrective-action tracking to closure.                 |
| Training             | Course authoring or import; assignment rules tied to role/department; completion tracking; certification expiry. |
| Analytics            | Cross-process and per-process dashboards: completion, cycle time, exception rate, training compliance.           |
| Audit                | Immutable, queryable audit log of material actions; export for external review.                                  |
| Improve              | Feedback loop from analytics/exceptions into AI-assisted process revision suggestions.                           |

## Non-functional requirements

### Multi-tenancy and data isolation

- Every tenant-owned record is scoped to an organization.
- Organization context is verified server-side on every request; a
  browser-supplied organization ID is never trusted on its own.
- PostgreSQL Row-Level Security enforces isolation at the database layer
  as defense in depth alongside application-layer checks.
- Cross-tenant access must be covered by automated tests before any phase
  that introduces new tenant-scoped data is considered complete.

See [multi-tenancy](../docs/architecture/multi-tenancy.md).

### Security

- Authorization is enforced server-side; the UI never is the only access
  control.
- Untrusted input (user-submitted, uploaded, or AI-generated) is validated
  before use.
- Secrets live only in managed secret stores (Codespaces, GitHub Actions,
  Vercel, provider dashboards) — never in the repository. See
  [SECURITY.md](../SECURITY.md).
- Suspended or removed members lose access immediately, with no cached
  session retaining stale permissions.

### Reliability

- Workflow state transitions are the record of truth for operational
  status — a task is either reliably tracked as done or reliably tracked
  as not done; there is no ambiguous state.
- Background processing (notifications, scheduled workflow starts,
  training-expiry checks) uses a provider-neutral adapter so the queue
  provider can change without a rewrite. See
  [event model](../docs/architecture/event-model.md).

### Accessibility

- The application meets WCAG 2.1 AA as a baseline for all core workflows,
  not just marketing pages. See [accessibility](../design/accessibility.md).

### Performance

- Core authenticated views (Home, My Work, Processes, Analytics) target
  sub-2-second perceived load on a typical broadband connection once the
  application has real data volumes to test against.

### Auditability

- Every publish, approval, exception resolution, and permission change
  produces an audit event. Audit events are immutable once written.

### AI governance

- AI-assisted output is always presented as a draft or suggestion
  requiring human action to take effect, per the boundaries in
  [AI architecture](../docs/architecture/ai-architecture.md).

## Explicitly out of scope for now

- Fully autonomous AI decision-making (see
  [AI architecture](../docs/architecture/ai-architecture.md)).
- Local/on-premise deployment — ProcessPilot is a managed cloud SaaS product
  (see [deployment architecture](../docs/architecture/deployment-architecture.md)).
- Native mobile apps — the initial responsive/PWA approach is defined in
  Phase 20 of the [phase tracker](../docs/project/phase-tracker.md).

## Related documents

- [Feature catalog](feature-catalog.md)
- [Assumptions and risks](assumptions-and-risks.md)
- [System overview](../docs/architecture/system-overview.md)
