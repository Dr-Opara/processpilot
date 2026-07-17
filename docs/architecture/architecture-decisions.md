# Architecture Decision Records

This is the index of Architecture Decision Records (ADRs) for
ProcessPilot. Individual records live in
[docs/architecture/decisions/](decisions/) and follow a consistent
format:

- **Status** — Proposed, Accepted, Superseded, or Deprecated.
- **Context** — the situation and constraints that made a decision
  necessary.
- **Decision** — what was decided.
- **Alternatives considered** — what else was evaluated and why it wasn't
  chosen.
- **Consequences** — what becomes easier or harder as a result.
- **Security implications** — how the decision affects the security
  posture described in [SECURITY.md](../../SECURITY.md) and the
  [architecture documents](.) in this directory.
- **Revisit conditions** — what would trigger revisiting this decision.

## Index

| ADR                                                          | Title                                             | Status   |
| ------------------------------------------------------------ | ------------------------------------------------- | -------- |
| [0001](decisions/0001-remote-first-development.md)           | Remote-first development using GitHub Codespaces  | Accepted |
| [0002](decisions/0002-nextjs-app-router.md)                  | Next.js App Router                                | Accepted |
| [0003](decisions/0003-clerk-identity.md)                     | Clerk for identity and organization membership    | Proposed |
| [0004](decisions/0004-supabase-postgresql.md)                | Supabase PostgreSQL and private storage           | Proposed |
| [0005](decisions/0005-postgresql-row-level-security.md)      | PostgreSQL Row-Level Security                     | Proposed |
| [0006](decisions/0006-vercel-deployment.md)                  | Vercel deployment                                 | Accepted |
| [0007](decisions/0007-stripe-billing.md)                     | Stripe billing                                    | Proposed |
| [0008](decisions/0008-provider-neutral-ai-abstraction.md)    | Provider-neutral AI abstraction                   | Proposed |
| [0009](decisions/0009-provider-neutral-background-jobs.md)   | Provider-neutral background jobs                  | Proposed |
| [0010](decisions/0010-event-driven-workflow-execution.md)    | Event-driven workflow execution                   | Proposed |
| [0011](decisions/0011-immutable-published-versions.md)       | Immutable published document and process versions | Accepted |
| [0012](decisions/0012-feature-branches-and-pull-requests.md) | Feature branches and pull requests                | Accepted |

"Accepted" marks decisions already reflected in the current repository
state (development workflow, framework choice, deployment target,
versioning model, branching model). "Proposed" marks decisions that set
direction for services not yet installed or integrated — they guide
implementation when their corresponding phase starts, and should be
moved to "Accepted" in the same change that first integrates the service,
or to "Superseded"/"Deprecated" if the direction changes before then.

## Related documents

- [System overview](system-overview.md)
- [Phase tracker](../project/phase-tracker.md)
