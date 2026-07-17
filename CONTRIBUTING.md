# Contributing to ProcessPilot

ProcessPilot is developed entirely in the cloud. There is no supported local
development setup — all work happens in a GitHub Codespace, validated by
GitHub Actions, and previewed on Vercel. See
[docs/development/cloud-development.md](docs/development/cloud-development.md)
for the full rationale and setup.

## Getting started

1. Open the repository in a GitHub Codespace (**Code > Codespaces > Create
   codespace on main**, or open an existing one).
2. Wait for the `postCreateCommand` to finish installing dependencies.
3. Run `npm run dev` and open the forwarded port-3000 URL to confirm the app
   boots.

## Branching model

See [docs/development/git-workflow.md](docs/development/git-workflow.md) for
the full model. Summary:

- `main` — protected, production. No direct commits.
- `develop` — shared integration branch. No direct commits.
- `feature/<phase-name>` — all work happens here, branched from `develop`,
  merged back via pull request.

## Before opening a pull request

Run the full validation suite in your Codespace:

```bash
npm run phase:commit
```

This runs formatting, lint, typecheck, unit tests, and a production build —
the same checks CI runs. Fix anything it reports before pushing.

## Commit and PR conventions

- Write commit messages that explain _why_, not just _what_.
- Keep pull requests scoped to one phase or one logical change.
- Fill out the full pull request template, including the environment
  variable and secrets checklist.
- Target `develop`, not `main`, unless you are cutting a release.
- Delete your feature branch after it merges.

## Code style

- TypeScript, formatted with Prettier (`npm run format`) and linted with
  ESLint (`npm run lint`) — both run in CI and must pass.
- Don't add abstractions, comments, or error handling for cases that can't
  happen. Keep changes scoped to what the task requires.

## Reporting bugs and requesting features

Use the issue templates under **Issues > New issue**. Never include secrets,
tokens, or credentials in an issue, PR, screenshot, or log — see
[SECURITY.md](SECURITY.md).
