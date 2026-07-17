# ProcessPilot

**The operating system for repeatable business work.**

ProcessPilot turns company procedures into guided, executable work that
employees can complete, managers can monitor, and organizations can
continuously improve. It converts policies, SOPs, forms, and
institutional knowledge into governed processes, executable workflows,
tasks, approvals, evidence, training, and audit records — with AI
assisting throughout, never acting independently on anything
consequential. See [product/vision.md](product/vision.md) for the full
product loop and [product/product-principles.md](product/product-principles.md)
for the principles behind every product decision.

This repository is production commercial software, not a prototype.

## Current phase

**Phase 1: Repository and design foundation** — turning the Phase 0
design documentation into a working Tailwind theme and component
primitive set. See [docs/project/phase-tracker.md](docs/project/phase-tracker.md)
for the full, sequenced list of phases with entry/exit criteria.

## Cloud-first development

This project is developed entirely through **GitHub Codespaces**. There is
no supported local development setup — no local Node.js, Docker, database,
build, test, or app server required. See
[docs/development/cloud-development.md](docs/development/cloud-development.md)
for the full model.

### Quick start

1. **Code > Codespaces > Create codespace on main** (or your feature
   branch).
2. Wait for setup to finish, then run:

   ```bash
   npm run dev
   ```

3. Open the forwarded port-3000 URL from the **Ports** tab.

### Common commands

```bash
npm run dev          # start the dev server
npm run format       # apply Prettier formatting
npm run lint         # ESLint
npm run typecheck    # TypeScript, check-only
npm run test         # unit tests (Vitest)
npm run test:e2e     # browser tests (Playwright)
npm run build        # production build
npm run env:check    # verify required environment variables
npm run git:status   # branch/tracking/working-tree summary
npm run phase:commit # full validation suite before committing
```

Run `npm run phase:commit` and confirm it's clean before every commit —
see [CONTRIBUTING.md](CONTRIBUTING.md).

## Repository structure

```
product/                   Product documentation: vision, roles,
                            permissions, requirements, roadmap, and more.
docs/
  architecture/             Technical architecture and ADRs.
    decisions/               Individual Architecture Decision Records.
  development/               Cloud development, git workflow, env vars.
  project/
    phase-tracker.md         Authoritative, sequenced phase plan.
design/                    Brand, color, typography, component, and
                            accessibility guidelines.
  logo/, icons/, mockups/    Design asset placeholders.
src/app/                   Next.js App Router source.
e2e/                       Playwright end-to-end tests.
scripts/                   Cloud-workflow helper scripts.
.github/                   CI, security, and issue/PR templates.
.devcontainer/             GitHub Codespaces environment definition.
```

## Documentation

- [Product vision](product/vision.md)
- [Feature catalog](product/feature-catalog.md)
- [User roles](product/user-roles.md) and
  [permissions matrix](product/permissions-matrix.md)
- [System overview](docs/architecture/system-overview.md) and
  [architecture decisions](docs/architecture/architecture-decisions.md)
- [Design branding](design/branding.md)
- [Phase tracker](docs/project/phase-tracker.md)
- [Cloud development model](docs/development/cloud-development.md)
- [Git workflow and branch protection](docs/development/git-workflow.md)
- [Environment variables](docs/development/environment-variables.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## Stack

Next.js (App Router, TypeScript) · GitHub Actions CI · Vercel deployments ·
managed cloud services for auth, database, storage, billing, queues,
email, and AI. See [system overview](docs/architecture/system-overview.md)
for the full planned stack and current implementation status.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the branching model, PR
process, and validation checklist. All work happens in a GitHub
Codespace, validated by GitHub Actions, and previewed on Vercel — never
on a local machine. See [CLAUDE.md](CLAUDE.md) for the full set of
permanent engineering rules this project follows.
