# ProcessPilot

ProcessPilot is a calm operating system for repeatable business work.

## Phase 1 foundation

This workspace includes:

- A Next.js App Router shell with a light-first visual system
- Shared UI primitives for layout, typography, actions, and feedback
- A marketing landing shell and an internal design-system route
- Vitest and Playwright setup for component and route validation

## Phase 2 marketing website

Built on the Phase 1 foundation:

- 30 public routes: homepage, product (hub + 7 pages), solutions (hub + 5 pages), industries (hub + 5 pages), pricing, security, resources, company, request-demo, start-trial, sign-in, privacy, terms
- Reusable, content-driven page templates (`ProductPageTemplate`, `SolutionPageTemplate`, `IndustryPageTemplate`) instead of one-off page components per product/solution/industry
- Request-demo, start-trial, and sign-in forms with client- and server-side validation (react-hook-form + zod), served by isolated development-mode API routes under `/api/*` — nothing is persisted, no email is sent, and every response says so explicitly
- SEO: unique per-page metadata, OpenGraph/Twitter tags, `sitemap.xml`, `robots.txt`
- Accessible navigation (keyboard-operable dropdowns, mobile menu), tabs, and FAQ accordion

### Local development

- Install dependencies with npm install
- Run the app with npm run dev
- Enable the internal design system route with NEXT_PUBLIC_ENABLE_DESIGN_SYSTEM=true
- Set NEXT_PUBLIC_SITE_URL to override the canonical/OpenGraph base URL (defaults to https://www.processpilot.com)

### Available scripts

- npm run dev
- npm run format
- npm run format:check
- npm run lint
- npm run typecheck
- npm run test
- npm run test:watch
- npm run test:e2e
- npm run build
