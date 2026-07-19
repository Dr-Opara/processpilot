# Milestone 2: Core Platform

**Status:** In Progress ([milestones.md](milestones.md)) · Phase 4 started
([phase tracker](phase-tracker.md)).

## Goal

Deliver the first secure, customer-testable ProcessPilot core platform.

## Customer journey

Milestone 2 is complete only when a real user can walk this journey
end-to-end, on a stable Vercel staging deployment, with every step
correctly tenant-isolated and permission-checked:

1. Create a business account.
2. Create an organization workspace.
3. Configure locations, departments, and teams.
4. Invite employees.
5. Upload or create a policy or SOP.
6. Review and publish the document.
7. Build a structured process.
8. Review and publish the process.
9. Start a workflow.
10. Assign employee work.
11. Complete tasks.
12. View workflow status and history.

This journey is the milestone's acceptance test in narrative form — see
[Definition of done](#definition-of-done) for how it's verified, and
[product/user-journeys.md](../../product/user-journeys.md) for the
persona-level journeys it's drawn from.

## Included phases

Full entry/exit criteria for each phase live in the
[phase tracker](phase-tracker.md); this section only summarizes scope.

### Phase 4 — Database and tenant isolation

- PostgreSQL schema (Supabase).
- Clerk-to-database identity mapping.
- Tenant isolation.
- Row-Level Security.
- Foundational audit events.

### Phase 5 — Business onboarding and employee management

- Company onboarding.
- Locations.
- Departments.
- Teams.
- Employee invitations.
- Employee directory.
- Roles and permissions.

### Phase 6 — Knowledge management

- Knowledge repository.
- Private document storage.
- Reviews.
- Publication.
- Immutable versions.
- Employee acknowledgment.

### Phase 7 — Process builder

- Structured process definitions.
- Visual builder.
- Validation.
- Reviews.
- Publication.
- Templates.

### Phase 8 — Workflow execution engine

- Workflow runtime.
- Task assignment.
- Decisions.
- Parallel paths.
- Deadlines.
- Event history.
- Task completion.

### Phase 8.5 — MVP staging and design-partner validation

- End-to-end testing.
- Demo workspace.
- Vercel staging deployment.
- Customer feedback.
- Design-partner outreach.

This is a milestone-specific validation gate, not a substitute for the
later, broader passes in
[Phase 24 — Complete QA](phase-tracker.md#phase-24-complete-qa) (full
regression across every persona and permission boundary ahead of general
availability) or
[Phase 28 — Demo workspace](phase-tracker.md#phase-28-demo-workspace) (the
persistent sales/prospect demo org). Phase 8.5 exists to prove the Milestone
2 core loop works for one real design partner before Milestone 3 begins —
narrower in scope than either of those later phases.

## Excluded until after MVP

The following are explicitly out of scope for Milestone 2, regardless of
how straightforward they might seem to add opportunistically:

- Native mobile applications.
- Advanced billing.
- Advanced analytics.
- Slack and Teams integrations.
- Full training system.
- Advanced exception management.
- Broad AI automation.
- Complex BPMN support.
- Enterprise SSO beyond current readiness.

## Definition of done

Milestone 2 is complete only when all of the following hold:

- Tenant-isolation tests pass.
- A customer can complete the full core journey above.
- Authentication works in a deployed environment.
- Documents remain private.
- Published document versions are immutable.
- Published process versions are immutable.
- Workflows retain exact process-version references.
- Task completion is idempotent.
- Audit history is available.
- Critical Playwright journeys pass.
- Vercel staging deployment is stable.
- Known limitations are documented.

## Related documents

- [Milestones](milestones.md)
- [Roadmap](roadmap.md)
- [Phase tracker](phase-tracker.md)
- [Current project status](current-project-status.md)
- [Domain model](../architecture/domain-model.md)
- [Multi-tenancy](../architecture/multi-tenancy.md)
- [product/user-journeys.md](../../product/user-journeys.md)
- [product/requirements.md](../../product/requirements.md)
