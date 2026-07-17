# ADR-0006: Vercel deployment

## Status

Accepted (Git connection is a manual one-time setup step not yet
performed — see [cloud-development.md](../../development/cloud-development.md);
the architectural decision itself is accepted).

## Context

ProcessPilot's remote-first workflow (see
[ADR-0001](0001-remote-first-development.md)) requires a hosting platform
that deploys automatically from Git, provides per-PR preview URLs for
visual review (per [CLAUDE.md](../../../CLAUDE.md): "Use Vercel preview
URLs for visual review of UI changes, not a description of what a local
server would show"), and integrates tightly with the chosen framework.

## Decision

Deploy to Vercel, Git-connected to this repository: automatic Preview
deployments for every PR/non-production branch push, automatic Production
deployment from `main`. See
[deployment-architecture.md](../deployment-architecture.md).

## Alternatives considered

- **Self-managed hosting (e.g. a VM or container platform run by the
  team).** Rejected outright — contradicts the remote-first, no
  self-managed-infrastructure model in [CLAUDE.md](../../../CLAUDE.md).
- **Netlify or another Git-connected static/edge host.** Considered
  viable; Vercel was chosen for being built by the same team as Next.js,
  giving the most direct support for App Router features (server
  components, server actions, edge/server runtime choices) with the
  least configuration.

## Consequences

- Every PR gets a reviewable, real preview URL — no "trust me, it works
  locally" review process.
- Deployment configuration lives in the Vercel dashboard (documented in
  [cloud-development.md](../../development/cloud-development.md)), not in
  a custom deploy script the team must maintain.
- Ties production hosting to Vercel; acceptable given the framework
  choice already couples closely to it.

## Security implications

Production and Preview environment variables are configured separately
in Vercel and must never share live production secrets with Preview
(test-mode credentials only in Preview) — see
[environment-variables.md](../../development/environment-variables.md).

## Revisit conditions

Revisit only if Vercel becomes unable to support a hard technical or
commercial requirement — not for cost optimization alone without a
concrete trigger.
