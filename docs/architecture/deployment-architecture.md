# Deployment Architecture

## Current state (Phase 0)

- Hosting target: Vercel, Git-connected (not yet connected — see
  [cloud-development.md — connecting the repository](../development/cloud-development.md)).
- No database, auth, storage, or billing provider is connected yet.
- CI (GitHub Actions) validates every push/PR to `main` and `develop`; see
  [.github/workflows/ci.yml](../../.github/workflows/ci.yml).

## Target deployment model

| Environment | Trigger                                            | Branch | Notes                                                                                                                       |
| ----------- | -------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------- |
| Preview     | Every PR and every push to a non-production branch | any    | Own scoped environment variables; used for visual review — see [cloud-development.md](../development/cloud-development.md). |
| Production  | Push/merge to `main`                               | `main` | Production environment variables and credentials only here.                                                                 |

This mirrors the [branching model](../../CLAUDE.md) — `main` is
production, `develop` is integration, `feature/*` branches get preview
deployments through their PRs.

## Build and deploy pipeline

1. Push/PR triggers GitHub Actions CI: format check, lint, typecheck,
   unit tests, production build (`npm run build`), secret scanning,
   dependency review — see
   [.github/workflows/ci.yml](../../.github/workflows/ci.yml) and
   [security.yml](../../.github/workflows/security.yml).
2. Independently, Vercel's GitHub integration builds and deploys the same
   commit to a Preview (or Production, on `main`) environment.
3. [.github/workflows/preview-checks.yml](../../.github/workflows/preview-checks.yml)
   runs a smoke test and Playwright suite against the live Preview URL
   once Vercel reports a successful deployment.

CI and Vercel deployment are independent, parallel pipelines against the
same commit — a green CI run is not a prerequisite that blocks a Vercel
preview from building, but branch protection (once configured, see
[git-workflow.md](../development/git-workflow.md)) requires CI to pass
before merge into `develop`/`main`.

## Configuration and secrets

All environment-specific configuration follows
[environment-variables.md](../development/environment-variables.md):
Codespaces secrets for development, GitHub Actions secrets for CI, Vercel
project environment variables (scoped per environment) for Preview/
Production. No environment shares live production credentials with
Preview.

## Rollback

Vercel retains prior deployments; rolling back to a previous production
deployment is a Vercel-dashboard operation, not a git revert requirement,
for time-sensitive incidents — though a git revert should still follow to
keep `main` consistent with what's actually deployed.

## Related documents

- [Cloud development model](../development/cloud-development.md)
- [Git workflow](../development/git-workflow.md)
- [Observability](observability.md)
- [ADR-0006: Vercel deployment](decisions/0006-vercel-deployment.md)
