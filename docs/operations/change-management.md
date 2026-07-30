# Change Management Procedures

Status: **Documents the process this repository already follows** (see
[CLAUDE.md](../../CLAUDE.md)'s branching model and engineering rules), not
a new process invented for this phase.

## Process

1. All work happens on a feature branch, never directly on `develop` or
   `main` (both protected, per [CLAUDE.md](../../CLAUDE.md)).
2. Every change is submitted as a pull request targeting `develop`.
3. `npm run phase:commit` (format, lint, typecheck, unit tests, production
   build) must pass locally before pushing.
4. CI re-runs the same checks plus CodeQL, secret scanning, dependency
   review, and (where a preview deployment exists) a smoke test —
   see [.github/workflows/](../../.github/workflows/).
5. A pull request merges only after all required checks pass.
6. Database migrations are forward-only — an already-applied migration
   is never edited in place; a correction ships as a new migration.

## Emergency changes

A production incident fix follows the same PR process — there is no
"skip CI" fast path in this repository, since skipping checks in an
emergency is exactly when a mistake is most likely and most costly.

## Related documents

- [Release management](release-management.md)
- [Production access procedures](production-access-procedures.md)
