# ADR-0001: Remote-first development using GitHub Codespaces

## Status

Accepted

## Context

ProcessPilot is a commercial product built by a small team (potentially a
single developer working with Claude Code) that needs a consistent,
low-friction, secure development environment without depending on the
state of any one personal machine. Local setup drift (differing Node
versions, missing dependencies, OS-specific issues) is a common source of
"works on my machine" failures and onboarding friction.

## Decision

All development happens inside GitHub Codespaces, defined by
[.devcontainer/devcontainer.json](../../../.devcontainer/devcontainer.json).
No step in the normal workflow (install, dev server, lint, test, build)
is supported or documented as running on a contributor's personal
machine. See [cloud-development.md](../../development/cloud-development.md).

## Alternatives considered

- **Local development with a documented setup script.** Rejected: still
  subject to per-machine drift, requires contributors to install Node/
  dependencies locally, and does not eliminate the "works on my machine"
  failure mode this decision is meant to avoid.
- **Docker Compose for local parity.** Rejected: still requires local
  Docker, which [CLAUDE.md](../../../CLAUDE.md) explicitly rules out, and
  adds local resource overhead without the disposability benefit of a
  cloud-hosted Codespace.

## Consequences

- Every contributor gets an identical, versioned environment.
- No credential or secret needs to touch a personal machine.
- A broken environment is deleted and recreated in minutes.
- Development is dependent on GitHub Codespaces availability and the
  contributor having a network connection — accepted as a reasonable
  tradeoff given the target team structure.

## Security implications

Secrets live only in Codespaces secrets, GitHub Actions secrets, Vercel,
or provider dashboards — never on a personal machine or in the
repository. See [SECURITY.md](../../../SECURITY.md).

## Revisit conditions

Revisit if the contributor base grows to include people who require
offline development, or if Codespaces cost/availability becomes a
blocker at the team's scale.
