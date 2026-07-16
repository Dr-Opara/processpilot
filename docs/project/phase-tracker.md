# Phase tracker

## Phase 1 — Application and design-system foundation

Status: Complete

### Completed

- Created a production-ready Next.js App Router shell with light-first styling and shared design tokens.
- Added shared UI primitives for layout, typography, actions, feedback, and forms.
- Built a marketing landing shell and an internal design-system route guarded by an environment flag.
- Added Vitest component tests and a Playwright smoke test for the design-system route.
- Added the required package scripts and local configuration for dev, lint, typecheck, test, e2e, and build.

### Notes

- Authentication, database access, billing, AI, workflow execution, and real customer data remain intentionally out of scope for this phase.
- The design-system route is available only when NEXT_PUBLIC_ENABLE_DESIGN_SYSTEM=true.
