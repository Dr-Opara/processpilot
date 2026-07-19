# Repository Map

A directory-level map of the repository, kept in sync with what's actually
committed — update this in the same change that adds, removes, or
repurposes a top-level directory. See [README.md](../../README.md) for the
shorter, newcomer-facing version of this map.

```
processpilot/
├── .devcontainer/            GitHub Codespaces environment definition
│                              (devcontainer.json, postCreate/postStart).
├── .github/
│   └── workflows/             ci.yml, preview-checks.yml, security.yml.
├── design/                   Brand, color, typography, spacing, component,
│                              layout, accessibility, and content-style
│                              guidelines.
│   ├── logo/, icons/, mockups/  Asset placeholders (no approved assets yet
│                              — see design/branding.md).
├── docs/
│   ├── architecture/          System overview, domain model, multi-tenancy,
│   │                          auth, data ownership, event model, workflow
│   │                          engine, AI/integration/billing/file-storage/
│   │                          deployment/observability architecture.
│   │   └── decisions/          Individual Architecture Decision Records
│   │                          (ADR-0001–0012).
│   ├── development/           cloud-development.md, git-workflow.md,
│   │                          environment-variables.md.
│   └── project/                phase-tracker.md (authoritative phase plan),
│                              milestones.md, roadmap.md, this file,
│                              current-project-status.md, changelog.md,
│                              milestone-N-*.md detail docs.
├── e2e/                      Playwright end-to-end specs + global-setup.ts.
├── product/                   Vision, principles, requirements, feature
│                              catalog, personas, user roles, permissions
│                              matrix, information architecture, user
│                              journeys, terminology, roadmap, release plan,
│                              pricing hypotheses, success metrics,
│                              assumptions/risks, changelog.
├── scripts/                   Cloud-workflow helper scripts (env check,
│                              git status, phase-commit validation suite).
├── src/
│   ├── app/                   Next.js App Router routes.
│   │   ├── api/                Route handlers: request-demo, start-trial,
│   │   │                      webhooks/clerk.
│   │   ├── app/                 The authenticated application shell.
│   │   │   ├── (auth)/            Sign-in/sign-up (public within /app).
│   │   │   └── (protected)/       Routes gated by requireAuth().
│   │   ├── design-system/       Internal component gallery (gated by
│   │   │                      NEXT_PUBLIC_ENABLE_DESIGN_SYSTEM).
│   │   └── <marketing routes>/  company, industries/*, pricing, privacy,
│   │                          product/*, request-demo, resources, security,
│   │                          solutions/*, start-trial, terms.
│   ├── components/
│   │   ├── application/        Authenticated-app-shell components.
│   │   ├── marketing/           Marketing site components (forms/,
│   │   │                      sections/, templates/).
│   │   └── ui/                  Shared design-system primitives.
│   ├── content/                Content-driven page data (homepage,
│   │                          pricing, industries/*, product/*,
│   │                          solutions/*, site nav, SEO).
│   └── lib/                    Server-only utilities: auth.ts (requireAuth),
│                              app-host.ts, clerk-appearance.ts, seo.ts,
│                              validation.ts.
├── CLAUDE.md                 Permanent engineering rules for AI-assisted
│                              work in this repository.
├── CONTRIBUTING.md, SECURITY.md, README.md
├── middleware.ts              Clerk middleware; app.* host rewrite only —
│                              route protection lives in (protected)/layout.
├── package.json                npm scripts: dev, build, lint, typecheck,
│                              test, test:e2e, env:check, git:status,
│                              phase:commit.
└── <config>                    next.config.ts, tailwind.config.ts,
                               tsconfig.json, vitest.config.ts,
                               eslint.config.mjs, playwright.config.ts.
```

## What lives where, by concern

| Concern                          | Location                                                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Product decisions and scope      | `product/`                                                                                                    |
| Technical architecture and ADRs  | `docs/architecture/`                                                                                          |
| Sequenced delivery plan          | `docs/project/phase-tracker.md`, `milestones.md`, `roadmap.md`                                                |
| Visual/brand system              | `design/`                                                                                                     |
| Application source               | `src/`                                                                                                        |
| Server-only auth/authz utilities | `src/lib/auth.ts` (Clerk session), server authorization services land in Phase 4 alongside the database layer |
| Route handlers (webhooks, forms) | `src/app/api/`                                                                                                |
| End-to-end tests                 | `e2e/`                                                                                                        |
| Unit tests                       | Co-located `*.test.ts(x)` next to the code under test                                                         |
| CI/CD                            | `.github/workflows/`                                                                                          |
| Cloud dev environment            | `.devcontainer/`                                                                                              |

Database migrations, generated types, and server-side data-access code
(introduced in Phase 4) will add a `supabase/` (or equivalent) directory
and `src/lib/db/`-style module boundary, documented in
`docs/architecture/database-schema.md` once Phase 4 creates it — this
document is updated in the same change that adds them.

## Related documents

- [README.md](../../README.md)
- [Phase tracker](phase-tracker.md)
- [Milestones](milestones.md)
