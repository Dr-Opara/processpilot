# Environment Variables

All variable **names** are documented in
[.env.example](../../.env.example) with safe placeholder values. Real
values are never committed to this repository. This document explains what
each variable is for and where its real value is configured.

## Where secrets live

| Context                      | Where to set real values                                                                                                         |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Codespaces (development)     | Repository or org **Settings > Secrets and variables > Codespaces**                                                              |
| GitHub Actions (CI)          | Repository **Settings > Secrets and variables > Actions** (use environments to separate staging/production secrets if needed)    |
| Vercel (preview/production)  | Vercel dashboard > Project > **Settings > Environment Variables**, scoped per environment                                        |
| Provider-managed credentials | The provider's own dashboard (e.g. Stripe, database host) — copy the value into the destinations above, don't store it elsewhere |

Never put real credentials in `.env.example`, source files, git history,
pull request descriptions, screenshots, or logs. See
[SECURITY.md](../../SECURITY.md).

## Current variables

| Variable                           | Purpose                                                                       | Required in this phase?              |
| ---------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------ |
| `NODE_ENV`                         | Standard Node/Next.js environment flag                                        | Set automatically by the runtime     |
| `NEXT_PUBLIC_APP_URL`              | Canonical app URL, exposed to the browser                                     | Not yet consumed by code             |
| `NEXT_PUBLIC_ENABLE_DESIGN_SYSTEM` | Gates the internal `/design-system` component gallery route (404s when unset) | Set to `true` in Vercel Preview only |

## Planned variables (documented now, enforced as each phase lands)

| Variable                                                                    | Purpose                                          |
| --------------------------------------------------------------------------- | ------------------------------------------------ |
| `DATABASE_URL`                                                              | Postgres connection string (e.g. Neon, Supabase) |
| `AUTH_SECRET`, `AUTH_URL`                                                   | Authentication provider configuration            |
| `STORAGE_BUCKET_NAME`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY` | Object storage for uploads                       |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`                                | Billing                                          |
| `QUEUE_CONNECTION_URL`                                                      | Background job / queue connection                |
| `EMAIL_FROM_ADDRESS`, `EMAIL_PROVIDER_API_KEY`                              | Transactional email                              |
| `ANTHROPIC_API_KEY`                                                         | AI features backed by the Claude API             |

Vercel also injects its own build/runtime variables (`VERCEL`,
`VERCEL_ENV`, `VERCEL_URL`, etc.) automatically — no action needed.

## Validation

```bash
npm run env:check
```

This cross-checks a hand-maintained required list in
[scripts/check-env.mjs](../../scripts/check-env.mjs) against what's set in
the environment, and fails with a clear message listing exactly what's
missing. Nothing is required yet in Phase -1 (no external integration is
implemented); a variable is added to the required list in the same change
that wires its integration into the app, so CI never silently passes with a
missing dependency.

## Adding a new variable

1. Add the name and a safe placeholder to `.env.example`, in the relevant
   section, with a one-line comment if its purpose isn't obvious.
2. Add a row to this document.
3. If the app now depends on it to build or run, add it to `REQUIRED_VARS`
   in `scripts/check-env.mjs`.
4. Set the real value in Codespaces secrets (and Actions/Vercel as
   applicable) — never in a file that gets committed.
