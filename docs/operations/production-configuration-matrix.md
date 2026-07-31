# Production Configuration Matrix (Phase 26, updated through Phase 30)

The single source of truth for what's actually provisioned/verified vs.
what remains configuration scaffolding. Written in Phase 26; table row
counts and RLS coverage kept current through Phase 30 — no infrastructure
status itself changed between Phase 26 and Phase 30 (still no production
Vercel/Supabase/Clerk project exists). Status legend:
**Real** (implemented and verifiable in this environment without a
production account), **Configured, unverified** (code path exists and
is unit-tested, but not exercised against a real production credential),
**Not provisioned** (requires a real account/purchase this environment
doesn't have).

| System                             | Status                             | Detail                                                                                                                                                                                                                |
| ---------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub repository + CI             | Real                               | Every workflow (`ci.yml`, `security.yml`, `preview-checks.yml`) runs on every push/PR today.                                                                                                                          |
| Vercel (development/preview)       | Real                               | Existing preview deployments have built and passed smoke tests throughout this project's history (see any merged phase's PR).                                                                                         |
| Vercel (production project)        | Not provisioned                    | No production Vercel project/domain exists.                                                                                                                                                                           |
| Domain (`useprocesspilot.com`)     | Not provisioned                    | Not registered/pointed at Vercel — see [dns-records.md](dns-records.md).                                                                                                                                              |
| Supabase (database schema/RLS)     | Real, statically verified          | 85 tables, 100% RLS/policy/index coverage, verified by `schema-coverage.test.ts` on every CI run — no live database needed for this proof.                                                                            |
| Supabase (live production project) | Not provisioned                    | No project is linked; live-Postgres integration tests and a real migration application have never run.                                                                                                                |
| Clerk (development instance)       | Real                               | Used for local/preview auth; development-mode keys, per Vercel preview logs seen throughout this project.                                                                                                             |
| Clerk (production instance)        | Not provisioned                    | No production Clerk instance/domain configured.                                                                                                                                                                       |
| Stripe                             | Configured, unverified             | Billing adapter (Phase 17) is real code, fails safely when unconfigured; no real Stripe account/price catalog exists.                                                                                                 |
| Resend (email)                     | Configured, unverified             | Email adapter (Phase 16) is real code; no real Resend account/verified sending domain exists.                                                                                                                         |
| Anthropic (AI)                     | Configured, unverified             | AI adapter (Phase 13) is real code, governance boundary statically tested; no real API key exists.                                                                                                                    |
| Slack                              | Configured, unverified             | One real OAuth/Events-API adapter (Phase 18); no real Slack app/credentials exist.                                                                                                                                    |
| Sentry / error reporting           | Not provisioned                    | Adapter shape exists (Phase 23); no SDK dependency added, no DSN configured.                                                                                                                                          |
| Uptime monitoring                  | Not provisioned                    | `/api/health`/`/api/ready` are real and pollable; no external monitor is configured to poll them.                                                                                                                     |
| Security headers (CSP/HSTS/etc.)   | Real                               | Live in every deployment today (Phase 22), verified by `e2e/security-headers.spec.ts` against a real running server.                                                                                                  |
| Background job worker              | Real                               | Runs on every deployment via Vercel Cron (`CRON_SECRET`-gated); concurrency/retry/dead-letter behavior proven by `background_jobs.integration.test.ts` (skips itself without a live database, same as the RLS suite). |
| Legal documents                    | Real content, not legally reviewed | Terms/Privacy/AUP/etc. (Phase 25) are accurate to the built product but explicitly labeled `draft` — no attorney review has occurred.                                                                                 |
| Backups                            | Not provisioned                    | No production Supabase project exists to configure backups for.                                                                                                                                                       |
| DR/restore drill                   | Not performed                      | No production environment exists to drill against.                                                                                                                                                                    |

## What this phase could and could not verify

**Could verify (and did):**

- Migration schema/RLS coverage (static, `schema-coverage.test.ts`).
- Production build succeeds (`npm run build`).
- No service-role secret in the client bundle
  (`check:bundle-secrets`).
- Security headers reach a real response
  (`e2e/security-headers.spec.ts`).
- Health/readiness endpoints return correct shapes
  (`src/app/api/health/route.test.ts`,
  `src/app/api/ready/route.test.ts`).

**Could not verify (requires real credentials/accounts this environment
doesn't have — not attempted, not faked):**

- A real migration sequence applied to a production-like Postgres
  instance.
- A real restore-from-backup drill.
- DNS actually resolving to a real Vercel deployment.
- A real end-to-end deployment/rollback cycle.
- Live provider verification for Stripe/Resend/Anthropic/Slack/Sentry.

## Related documents

- [Deployment architecture](../architecture/deployment-architecture.md)
- [Deployment runbook](deployment-runbook.md)
- [DNS records](dns-records.md)
- [Environment variables](../development/environment-variables.md)
