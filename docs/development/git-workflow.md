# Git Workflow

## Branches

| Branch                 | Purpose                                      | Protected | Direct commits                            |
| ---------------------- | -------------------------------------------- | --------- | ----------------------------------------- |
| `main`                 | Production. Deploys to production on Vercel. | Yes       | Never                                     |
| `develop`              | Shared integration branch.                   | Yes       | Never                                     |
| `feature/<phase-name>` | All work for one phase or change.            | No        | Yes (only branch type where this happens) |

Feature branch names describe the phase or change, e.g.
`feature/cloud-foundation`, `feature/auth-integration`.

## Standard flow

```bash
# start a phase
git checkout develop
git pull
git checkout -b feature/<phase-name>

# work, then before committing
npm run phase:commit   # format check, lint, typecheck, test, build

git add <files>
git commit -m "..."
git push -u origin feature/<phase-name>

# open a PR into develop
gh pr create --base develop --title "..." --body "..."
```

After a phase's PR is approved and merged into `develop`, delete the
feature branch (GitHub can do this automatically on merge, or run
`git push origin --delete feature/<phase-name>`).

Periodically, `develop` is merged into `main` via its own pull request to
cut a release. `main` only ever receives changes through a PR from
`develop` (or an urgent hotfix branch, reviewed the same way).

## Rules

- No feature work is committed directly to `main`.
- No feature work is committed directly to `develop`.
- Every completed phase is committed and pushed, and submitted through a
  pull request.
- Feature branches are deleted after successful merge.
- Never force-push `main` or `develop`.
- Never commit secrets (see [SECURITY.md](../../SECURITY.md)).

## Recommended GitHub branch protection settings

Configure these under **Settings > Branches > Branch protection rules** for
this repository. This documents the intended configuration — Claude Code
does not (and cannot) change GitHub account/repo settings on your behalf.

### `main`

- Require a pull request before merging
- Require at least one approval once collaborators are added
- Require status checks to pass before merging (CI workflow)
- Require conversation resolution before merging
- Require branches to be up to date before merging
- Do not allow force pushes
- Do not allow branch deletion
- Restrict who can push directly (no one, in practice — enforce via PR only)
- Consider requiring signed commits once that's operationally practical

### `develop`

- Require a pull request before merging
- Require status checks to pass before merging (CI workflow)
- Do not allow force pushes

## Pull requests

- Use the template at
  [.github/pull_request_template.md](../../.github/pull_request_template.md).
- Target `develop` by default; only target `main` for a release PR.
- CI must be green before requesting review.
- Squash or merge per your preference, but keep history readable — this
  repo does not mandate one merge strategy over another yet.
