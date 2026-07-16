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

## Phase 2 — Application and design-system foundation website

Status: Complete

### Completed

- Built all 30 required public routes (homepage; product hub + 7 product pages; solutions hub + 5 solution pages; industries hub + 5 industry pages; pricing, security, resources, company; request-demo, start-trial, sign-in; privacy, terms) using shared, content-driven page templates rather than one-off page components per product/solution/industry.
- Homepage includes all 14 required sections: sticky nav, coded-mockup hero, business problem, six-stage operating loop, four product pillars, accessible role-preview tabs, procedure-to-workflow transformation demo, AI capabilities (with human-review framing), multi-location section, governance/security section, pricing preview, FAQ accordion, final CTA, and enterprise footer.
- Request-demo, start-trial, and sign-in forms validate client-side (react-hook-form + zod) and server-side (isolated dev-mode API routes under `/api/*`). No submissions are persisted, no email is sent, and every successful submission surfaces an explicit "development mode" message — nothing implies an account or record was created.
- Security page states only planned/designed controls, explicitly disclaims SOC 2 / ISO 27001 / HIPAA / FedRAMP / HITRUST / GDPR / PCI certification, and links to a security contact.
- SEO: per-page unique titles/descriptions/canonical URLs via a shared `buildMetadata` helper, OpenGraph/Twitter metadata, `sitemap.ts`, `robots.ts`, and a title template on the root layout.
- Accessibility: keyboard-operable nav dropdowns and mobile menu, accessible tabs (role-preview) and accordion (FAQ) with proper ARIA wiring, visible focus rings, form labels/errors via `aria-invalid`/`aria-describedby`, `prefers-reduced-motion` support (carried over from Phase 1).
- Added 17 Vitest unit/component tests and 48 Playwright e2e tests covering navigation, mobile menu, role tabs, FAQ controls, both marketing forms' validation and dev-mode success paths, all 30 critical routes, the 404 page, metadata generation, and responsive layout at desktop/tablet/mobile widths.
- Fixed two pre-existing bugs surfaced during the visual/automated audit: `Button`/`Select`/`Textarea`/`Checkbox` weren't forwarding refs (breaking react-hook-form's uncontrolled field tracking), and the role-preview tabs showed all five panels at once because a Tailwind `grid` class silently beat the native `hidden` attribute in the browser's cascade. Also fixed `CtaBand`'s primary button, which rendered invisible (white-on-white) text due to conflicting Tailwind utility overrides — replaced with dedicated `onDark`/`outlineOnDark` Button variants.

### Notes

- Real account creation, authentication, database persistence, and payment collection remain out of scope for this phase; all form submissions are explicitly labeled as development-mode.
- No product screenshots or competitor assets were used — all product visuals are coded mockups built from the existing design system.
- Demo content consistently uses one fictional company, Northstar Property Group, labeled as product demonstration data throughout.
