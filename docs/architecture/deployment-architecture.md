# Deployment Architecture

## Phase 26 status

No real production Vercel project, Supabase project, or Clerk production
instance is provisioned in this environment — the same "credential-gated"
posture every prior phase has carried. What follows is the deployment
design and configuration this app is built to run under, plus exactly
what's real vs. what still requires a human to provision a real account
and credentials — see
[production-configuration-matrix.md](../operations/production-configuration-matrix.md)
for the complete, itemized breakdown.

## Domain

**Intended public domain: `useprocesspilot.com`**, per the revised
company positioning (`www.useprocesspilot.com` for the marketing site,
`app.useprocesspilot.com` for the authenticated application — see
[ADR-0002](decisions/0002-nextjs-app-router.md)'s one-app-two-subdomains
decision). `src/lib/seo.ts`'s `getSiteUrl()` and
`src/lib/jobs/notification-handlers.ts`'s `APP_URL` both default to this
domain when `NEXT_PUBLIC_SITE_URL`/`NEXT_PUBLIC_APP_URL` are unset; both
must be set to the real domain in Vercel's production environment
variables once DNS is actually configured (see
[dns-records.md](../operations/dns-records.md)). No domain is registered
or pointed at Vercel in this environment — this is a configuration
target, not a claim that the domain currently resolves anywhere.

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
   dependency review, CodeQL, `npm audit` — see
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
Preview — this is a hard rule, not just a convention: every provider
adapter's `is*Configured()` check reads from `process.env` directly, so
setting a real production credential in the Preview environment scope
would leak it to every PR preview deployment. Production credentials
belong only in Vercel's Production environment scope.

## Marketing/app subdomain routing

Per [ADR-0002](decisions/0002-nextjs-app-router.md) and
[product/information-architecture.md](../../product/information-architecture.md),
one Next.js app serves both `useprocesspilot.com` (marketing, statically
generated) and the authenticated `app.useprocesspilot.com`. Until that
domain is actually configured in Vercel, `middleware.ts` only rewrites
when a request's host starts with `app.` — production only, once DNS
exists. Everywhere else (Codespaces, Vercel preview URLs, localhost),
the routes under `src/app/app/` are reachable directly at `/app/*` by
path instead, which is how this app is tested today.

Route protection is not done in middleware — it's enforced per-route in
`src/app/app/(protected)/layout.tsx` via `requireAuth()`, matching the
"server-enforced, always, on every request" rule in
[authentication-and-authorization.md](authentication-and-authorization.md)
rather than relying on a single path-matching gate.

## Database migrations

Every migration under `supabase/migrations/` is forward-only (never
edited in place once applied — see
[change-management.md](../operations/change-management.md)).
`src/lib/db/schema-coverage.test.ts` statically validates every
migration file on every CI run (82 tables, 100% RLS/policy/index
coverage) — this is real, automated validation that runs today, without
needing a live database. **Not yet validated:** actually applying the
full migration sequence against a clean production-like Postgres
instance and the live-Postgres `*.integration.test.ts` suites — both
require a real, linked Supabase project, which doesn't exist in this
environment (the same gap carried since Phase 4).

## Storage buckets

Evidence and knowledge-document uploads use private Supabase Storage
buckets with signed-URL access (Phase 6/9) — the bucket configuration
itself (creation, RLS-equivalent access policy) happens in the Supabase
dashboard once a real project exists; the application code that issues
signed URLs only after a server-side permission check is already real
and tested.

## Backups and restoration

See [backup-and-restoration.md](../operations/backup-and-restoration.md)
and [disaster-recovery-plan.md](../operations/disaster-recovery-plan.md)
— both explicitly note no real restore has ever been performed, since no
production Supabase project exists to restore against.

## Health, readiness, and monitoring

`/api/health` (liveness) and `/api/ready` (readiness — database
connectivity, queue depth, provider configuration status) are real and
already deployed with every build (Phase 23,
[observability.md](../architecture/observability.md)). No uptime-monitoring
service is configured to poll them yet (credential-gated — no
account/subscription with an uptime-check provider exists).

## Rollback

Vercel retains prior deployments; rolling back to a previous production
deployment is a Vercel-dashboard "Promote to Production" operation on an
earlier deployment, not a git revert requirement, for time-sensitive
incidents — though a git revert should still follow to keep `main`
consistent with what's actually deployed. See
[release-management.md](../operations/release-management.md) and
[deployment-runbook.md](../operations/deployment-runbook.md) for the
full procedure.

## Related documents

- [Cloud development model](../development/cloud-development.md)
- [Git workflow](../development/git-workflow.md)
- [Environment variables](../development/environment-variables.md)
- [Observability](observability.md)
- [Deployment runbook](../operations/deployment-runbook.md)
- [Production configuration matrix](../operations/production-configuration-matrix.md)
- [DNS records](../operations/dns-records.md)
- [Post-deployment verification checklist](../operations/post-deployment-verification-checklist.md)
- [ADR-0006: Vercel deployment](decisions/0006-vercel-deployment.md)
