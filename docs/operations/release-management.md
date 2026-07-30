# Release Management Procedures

Status: **Describes the process actually used through Phase 25.**

## Promotion path

`feature/<phase-name>` → PR into `develop` → (future, Phase 26)
`develop` → PR into `main` → production deployment.

`develop` is the shared integration branch every phase has merged into
throughout this project's history (see
[docs/project/phase-tracker.md](../project/phase-tracker.md)). `main` is
reserved for production releases — no phase has promoted to `main` yet,
since no production deployment exists (Phase 26's job).

## Versioning

`package.json`'s `version` field is not yet used as a real semantic
release version (still `0.1.0` throughout pre-release development). Once
Phase 26 establishes production releases, each release promoted to `main`
should be tagged with a version and the commit SHA recorded — see
[Phase 30's release-readiness report](../../docs/project/phase-tracker.md)
for where that gets formalized.

## Rollback

See [deployment-architecture.md](../architecture/deployment-architecture.md)
(Phase 26) for the rollback/forward-fix procedure once a real production
deployment exists to roll back.

## Related documents

- [Change management](change-management.md)
- [Deployment architecture](../architecture/deployment-architecture.md)
