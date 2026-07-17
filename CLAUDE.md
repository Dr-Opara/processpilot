# CLAUDE.md

Guidance for Claude Code when working in the ProcessPilot repository.

## Project

ProcessPilot — the operating system for repeatable business work. A
Next.js (App Router, TypeScript) application.

## Remote-first development rules

ProcessPilot is developed entirely through GitHub Codespaces. These rules
are permanent and apply to every phase of work:

1. Assume all work occurs inside a GitHub Codespace.
2. Never instruct the user to install application dependencies directly on
   their personal computer.
3. Never require a locally installed database.
4. Never require local Docker.
5. Use managed cloud development services or isolated CI services for
   anything that would otherwise need local infrastructure.
6. Keep expensive builds and full test suites running in Codespaces or
   GitHub Actions, not proposed as local-machine steps.
7. Use Vercel preview URLs for visual review of UI changes, not a
   description of what a local server would show.
8. Commit and push every accepted phase.
9. Keep the working tree clean after each completed phase.
10. Stop the Codespace when work is finished, to reduce usage. Don't leave
    it running idle.
11. Do not delete a Codespace until all work has been committed and pushed.
12. Do not expose forwarded ports publicly without a specific, stated
    reason — port 3000 defaults to private visibility.
13. Do not store secrets inside Codespace configuration files
    (`.devcontainer/`, `.vscode/`, etc.) — see
    [docs/development/environment-variables.md](docs/development/environment-variables.md).

## Product, architecture, and design documentation

Before starting any feature work, read the relevant documents in:

- [product/](product/) — vision, principles, requirements, feature
  catalog, personas, roles, permissions matrix, information architecture,
  user journeys, terminology, roadmap, release plan, pricing hypotheses,
  success metrics, assumptions and risks.
- [docs/architecture/](docs/architecture/) — system overview, domain
  model, multi-tenancy, authentication and authorization, data ownership,
  event model, workflow engine, AI architecture, integration
  architecture, billing architecture, file storage, deployment
  architecture, observability, and
  [architecture decision records](docs/architecture/architecture-decisions.md).
- [design/](design/) — branding, colors, typography, spacing,
  components, application/marketing layout, accessibility, content style.
- [docs/project/phase-tracker.md](docs/project/phase-tracker.md) — the
  authoritative, sequenced record of every phase, with entry/exit
  criteria. Do not begin a phase whose dependencies are not marked
  `Complete`, and do not mark a phase `Complete` until its exit criteria
  are verifiably met.

Keep these documents in sync with what is actually built. A phase that
changes product scope or architecture updates the relevant document in
the same change — documentation drift is treated as a defect.

Use `product/terminology.md` precisely: "process," "workflow," and
"task" are distinct concepts and must never be used interchangeably in
code, copy, or documentation.

## Engineering rules

These rules are permanent and apply to every phase of work:

- Inspect the repository before every phase — read this file, README,
  CONTRIBUTING, SECURITY, the relevant `product/`, `docs/architecture/`,
  and `design/` documents, and the current state of the code before
  making changes.
- Preserve working functionality. Do not delete or break something that
  works without explaining why.
- Use the repository's package manager (npm — see
  [package.json](package.json)) and existing scripts; do not introduce a
  second package manager or duplicate tooling.
- Keep TypeScript strict (see [tsconfig.json](tsconfig.json)). Do not
  weaken `strict` mode or add `// @ts-ignore` to silence real errors.
- Do not use `any` without explanation — if it's genuinely necessary,
  leave a comment stating why a more specific type isn't possible.
- Validate untrusted input at system boundaries (user input, file
  uploads, external API responses, AI-generated output) before using it.
- Enforce authorization on the server. Every protected route, server
  action, and data query checks the caller's permissions and tenant
  scope server-side — see
  [docs/architecture/authentication-and-authorization.md](docs/architecture/authentication-and-authorization.md).
- Never rely on hidden or disabled UI as a security control. Hiding a
  button is UX, not access control.
- Keep business logic outside UI components — UI components render and
  dispatch; validation, authorization, and domain logic live in the
  server-side data/service layer.
- Prefer server components unless client-side interactivity is actually
  required.
- Avoid enormous files — split by responsibility as a module grows
  rather than letting one file accumulate unrelated concerns.
- Do not suppress lint rules to pass checks. Fix the underlying issue, or
  if a rule genuinely doesn't apply, disable it narrowly with a comment
  explaining why.
- Do not leave dead code or fake/stubbed functionality that looks
  complete but isn't — a partial implementation is either finished or
  clearly marked as not yet implemented, never presented as done.
- Do not commit secrets — see [SECURITY.md](SECURITY.md) and
  [docs/development/environment-variables.md](docs/development/environment-variables.md).
- Do not expose internal IDs or implementation details unnecessarily in
  URLs, API responses, or UI copy beyond what the feature requires.
- Use feature branches for all work — see [Branching model](#branching-model)
  below.
- Commit and push every accepted phase; keep the working tree clean once
  a phase is done.
- Use pull requests targeting `develop`; never push feature work directly
  to `main` or `develop`.
- Use Vercel previews for visual review of UI changes, not a description
  of what a local server would show.
- Run expensive builds and full test suites in Codespaces or GitHub
  Actions, never proposed as local-machine steps.
- Stop the Codespace when work is finished, and confirm all work is
  committed and pushed before deleting a Codespace.

## Branching model

- `main` — protected, production. No direct commits.
- `develop` — shared integration branch. No direct commits.
- `feature/<phase-name>` — all work happens here, branched from `develop`.

Every feature branch is submitted through a pull request into `develop` and
deleted after merge. Never force-push `main` or `develop`. Full detail in
[docs/development/git-workflow.md](docs/development/git-workflow.md).

## Before committing a phase

Run `npm run phase:commit` (format check, lint, typecheck, unit tests,
production build) and confirm it's clean before pushing.

## Reference docs

- [docs/development/cloud-development.md](docs/development/cloud-development.md)
- [docs/development/git-workflow.md](docs/development/git-workflow.md)
- [docs/development/environment-variables.md](docs/development/environment-variables.md)
- [docs/project/phase-tracker.md](docs/project/phase-tracker.md)
- [docs/architecture/architecture-decisions.md](docs/architecture/architecture-decisions.md)
- [product/vision.md](product/vision.md)
- [design/branding.md](design/branding.md)
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SECURITY.md](SECURITY.md)
