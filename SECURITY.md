# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in ProcessPilot, please report it
privately rather than opening a public issue:

- Use GitHub's [private vulnerability reporting](../../security/advisories/new)
  for this repository, or
- Email the maintainer directly (see repository owner contact on the GitHub
  profile).

Please include:

- A description of the vulnerability and its potential impact
- Steps to reproduce, or a proof of concept
- Any relevant logs — with secrets and credentials redacted

We aim to acknowledge reports within a few business days.

## Secret handling

This repository is developed with a cloud-first workflow, and secrets are
never expected to live on a contributor's local machine. Real credentials
belong only in:

- **GitHub Codespaces secrets** — development
- **GitHub Actions secrets/environments** — CI
- **Vercel project environment variables** — preview and production
- **Provider dashboards** — for provider-managed credentials (database,
  auth, storage, billing, email, AI, etc.)

Real credentials must never appear in:

- `.env.example` or any tracked file
- Source code, comments, or configuration
- Git history (including squashed or reverted commits)
- Pull request descriptions or code review comments
- Screenshots or recordings
- Logs or CI output

See [docs/development/environment-variables.md](docs/development/environment-variables.md)
for the full list of variables and where each one is configured.

## Automated scanning

- [.github/workflows/security.yml](.github/workflows/security.yml) runs
  secret scanning and dependency review on every pull request and on
  protected branches.
- [.github/dependabot.yml](.github/dependabot.yml) keeps npm packages,
  GitHub Actions, and the devcontainer image up to date with security
  patches.

If a secret is accidentally committed, treat it as compromised: rotate it
immediately with the provider, then remove it from git history.
