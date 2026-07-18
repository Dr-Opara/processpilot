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

## Marketing/app subdomain routing

Per [ADR-0002](decisions/0002-nextjs-app-router.md) and
[product/information-architecture.md](../../product/information-architecture.md),
one Next.js app serves both `processpilot.com` (marketing, statically
generated) and the authenticated `app.processpilot.com`. No custom domain
is configured yet, so `middleware.ts` only rewrites when a request's host
actually starts with `app.` — production, once that domain exists.
Everywhere else (Codespaces, Vercel preview URLs, localhost, none of
which can have that subdomain), the routes under `src/app/app/` are
reachable directly at `/app/*` by path instead, which is how this app is
tested today.

Route protection is not done in middleware — it's enforced per-route in
`src/app/app/(protected)/layout.tsx` via `requireAuth()`
(`src/lib/auth.ts`), matching the "server-enforced, always, on every
request" rule in
[authentication-and-authorization.md](authentication-and-authorization.md)
rather than relying on a single path-matching gate (Clerk's
`createRouteMatcher`-based middleware auth is deprecated in the SDK
version this project uses).

Redirect targets for sign-in/sign-up (`ClerkProvider`'s `signInUrl`/
`signUpUrl` in `src/app/layout.tsx`) are fixed `/app/sign-in` and
`/app/sign-up` paths rather than host-detected: computing them would
require reading `headers()` in the root layout, which wraps every
marketing page too and would force the entire static marketing site into
dynamic rendering just to pick a redirect path. The only cost today is a
redundant `/app` segment remaining in the URL if reached through a real
`app.processpilot.com` host — cosmetic, not functional, and worth
revisiting once a real deployment phase configures that domain.

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
