# ADR-0002: Next.js App Router

## Status

Accepted

## Context

ProcessPilot needs a single framework that serves both the public
marketing site and the authenticated, role-aware application, deploys
cleanly to a managed hosting platform, supports server-rendered pages for
SEO on the marketing side, and supports server-enforced authorization for
the application side (see
[authentication-and-authorization.md](../authentication-and-authorization.md)).

## Decision

Use Next.js with the App Router (not the Pages Router), TypeScript in
strict mode, as the sole application framework for both
processpilot.com and app.processpilot.com. Already implemented in the
repository — see [next.config.ts](../../../next.config.ts) and
[tsconfig.json](../../../tsconfig.json).

## Alternatives considered

- **Pages Router.** Rejected: App Router's server components and
  colocated data-fetching model fit the "server-enforced authorization"
  requirement more directly, and Pages Router is in maintenance mode
  relative to App Router within the Next.js ecosystem.
- **Separate frameworks for marketing vs. app** (e.g. a static site
  generator for marketing, a separate SPA framework for the app).
  Rejected: doubles tooling, CI, and deployment surface area for two
  properties that share a design system and a single Vercel project.
- **A non-Next.js React framework (Remix, plain Vite SPA).** Rejected:
  Next.js has the most direct integration with Vercel (the chosen
  hosting target, see [ADR-0006](0006-vercel-deployment.md)) and the
  broadest ecosystem fit for the planned managed-services stack (Clerk,
  Stripe) used in this project.

## Consequences

- Server components by default keep sensitive logic and secrets off the
  client by construction, supporting
  [authentication-and-authorization.md — non-negotiable rules](../authentication-and-authorization.md).
- Route handlers and server actions provide a natural home for
  server-enforced permission checks.
- The team commits to Next.js App Router conventions and its release
  cadence.

## Security implications

Server components reduce the default surface area for accidental client
exposure of sensitive logic, but do not eliminate the need for explicit
server-side authorization checks on every protected route/action.

## Revisit conditions

Revisit only if Next.js or Vercel becomes unable to support a hard
product requirement (unlikely given current roadmap) — not for stylistic
preference once real product code is built on top of it.
