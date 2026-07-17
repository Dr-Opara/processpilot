# System Overview

## Planned technology direction

This document describes the intended architecture direction for
ProcessPilot. Nothing described here is installed or implemented unless it
already exists in the repository (see the "Current state" section below) —
Phase 0 is documentation-only, per
[docs/project/phase-tracker.md](../project/phase-tracker.md).

| Layer                    | Choice                                                | Rationale summary (full detail in ADRs)                                                                                                                             |
| ------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework                | Next.js App Router, TypeScript strict mode            | Server components by default, colocated API routes/server actions, strong ecosystem fit with Vercel. [ADR-0002](decisions/0002-nextjs-app-router.md)                |
| Styling                  | Tailwind CSS, accessible component primitives         | Fast, consistent implementation of the [design system](../../design/components.md) without hand-rolled CSS sprawl.                                                  |
| Hosting                  | Vercel                                                | Git-connected preview/production deploys matching the [remote-first workflow](../development/cloud-development.md). [ADR-0006](decisions/0006-vercel-deployment.md) |
| Identity & organizations | Clerk                                                 | Multi-tenant auth and organization membership out of the box, reducing custom auth surface area. [ADR-0003](decisions/0003-clerk-identity.md)                       |
| Database                 | Supabase PostgreSQL                                   | Managed Postgres with built-in Row-Level Security support. [ADR-0004](decisions/0004-supabase-postgresql.md)                                                        |
| Tenant isolation         | PostgreSQL Row-Level Security                         | Database-layer enforcement as defense in depth alongside application checks. [ADR-0005](decisions/0005-postgresql-row-level-security.md)                            |
| File storage             | Supabase private storage                              | Private-by-default object storage colocated with the database provider.                                                                                             |
| Billing                  | Stripe                                                | Industry-standard subscription billing. [ADR-0007](decisions/0007-stripe-billing.md)                                                                                |
| Email                    | Provider-neutral adapter                              | Avoids coupling business logic to one transactional email vendor.                                                                                                   |
| Background jobs          | Provider-neutral adapter                              | Avoids coupling to one queue vendor; supports scheduled/triggered workflow starts. [ADR-0009](decisions/0009-provider-neutral-background-jobs.md)                   |
| AI                       | Provider-neutral adapter (Anthropic-backed initially) | Keeps AI governance boundaries in the application layer, independent of any one model vendor. [ADR-0008](decisions/0008-provider-neutral-ai-abstraction.md)         |
| CI                       | GitHub Actions                                        | Cloud validation matching the [remote-first](../../CLAUDE.md) development model.                                                                                    |
| Testing                  | Vitest (unit), Playwright (e2e)                       | Already wired into the repository; see "Current state" below.                                                                                                       |

## Current state (as of Phase 0)

Implemented and present in the repository today:

- Next.js 16 (App Router) + React 19 + TypeScript strict — see
  [tsconfig.json](../../tsconfig.json), [next.config.ts](../../next.config.ts).
- ESLint (`eslint-config-next`) and Prettier — see
  [eslint.config.mjs](../../eslint.config.mjs), [.prettierrc.json](../../.prettierrc.json).
- Vitest with jsdom + Testing Library — see
  [vitest.config.ts](../../vitest.config.ts).
- Playwright, configured to target the Codespaces-forwarded URL — see
  [playwright.config.ts](../../playwright.config.ts).
- GitHub Actions CI, security scanning (CodeQL, gitleaks, dependency
  review), and a preview-deployment smoke-test workflow — see
  [.github/workflows/](../../.github/workflows/).
- A single placeholder route (`src/app/page.tsx`) with no business logic.

Not yet implemented: Clerk, Supabase, Stripe, any database schema, any
email/queue/AI adapter, and all product features. These land in Phases 3
onward per the [phase tracker](../project/phase-tracker.md).

## Request flow (target shape)

1. Browser requests `app.processpilot.com`, authenticated via Clerk.
2. Next.js server components/route handlers resolve the caller's identity
   and organization context from the verified session — never from a
   client-supplied header or query parameter. See
   [authentication and authorization](authentication-and-authorization.md).
3. Data access goes through the application's data layer, which applies
   the caller's organization scope; PostgreSQL RLS enforces the same
   boundary independently. See [multi-tenancy](multi-tenancy.md).
4. Mutations that trigger downstream effects (notifications, scheduled
   workflow logic) publish events consumed by the background-job adapter.
   See [event model](event-model.md).
5. AI-assisted features call the provider-neutral AI adapter, which
   enforces the governance boundaries in
   [ai-architecture.md](ai-architecture.md) before returning a result to
   the UI as a draft.

## Related documents

- [Domain model](domain-model.md)
- [Multi-tenancy](multi-tenancy.md)
- [Deployment architecture](deployment-architecture.md)
- [Architecture decisions](architecture-decisions.md)
