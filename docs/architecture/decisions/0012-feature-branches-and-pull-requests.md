# ADR-0012: Feature branches and pull requests

## Status

Accepted — already reflected in current repository state and enforced by
[git-workflow.md](../../development/git-workflow.md).

## Context

ProcessPilot needs a branching and review model that supports the
remote-first workflow ([ADR-0001](0001-remote-first-development.md)),
gives every change a reviewable Vercel preview
([ADR-0006](0006-vercel-deployment.md)), and prevents direct, unreviewed
changes to production.

## Decision

Use a three-tier branching model: `main` (protected, production, no
direct commits), `develop` (shared integration branch, no direct
commits), and `feature/<phase-name>` branches (all work happens here,
branched from `develop`, merged back via pull request, deleted after
merge). See [git-workflow.md](../../development/git-workflow.md) for the
full flow and recommended branch-protection settings.

## Alternatives considered

- **Trunk-based development (commit directly to `main`, feature flags for
  incomplete work).** Rejected for this stage: without a mature
  feature-flagging system yet in place, direct-to-`main` commits would
  bypass the PR-based review and CI-gating model the team is committing
  to, and would deploy incomplete work straight to production via the
  Vercel Git connection.
- **GitFlow's full model (release branches, hotfix branches as
  first-class ongoing structures).** Rejected as more process than
  needed at this stage; a simpler two-protected-branch model
  (`main`/`develop`) plus feature branches covers the current team size
  and release cadence. Hotfix branches are handled ad hoc, reviewed the
  same way as any other change, without a permanent dedicated branch
  type.

## Consequences

- Every change is reviewable via a pull request and gets its own Vercel
  preview deployment before merging.
- `develop` accumulates completed phases before a periodic release PR
  promotes it to `main`.
- Adds minor process overhead (branch creation, PR, branch deletion) for
  every phase — accepted as necessary for review quality and preview-based
  visual verification (see [CLAUDE.md](../../../CLAUDE.md)).

## Security implications

No feature work reaches `main` or `develop` without passing through a
pull request and CI (once branch protection is configured per
[git-workflow.md](../../development/git-workflow.md)) — reduces the risk
of unreviewed or unvalidated code reaching production.

## Revisit conditions

Revisit if team size or release cadence changes enough that the
three-tier model adds more overhead than value (e.g. a much larger team
needing release branches, or a single-developer project simplifying
further) — not expected in the near term.
