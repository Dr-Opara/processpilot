# Release Plan

## Environments

| Environment               | Branch                           | Purpose             | Audience                       |
| ------------------------- | -------------------------------- | ------------------- | ------------------------------ |
| Preview                   | Every PR / non-production branch | Per-change review   | Internal team, reviewers       |
| Staging (optional, later) | `staging` (if introduced)        | Pre-production soak | Internal team, design partners |
| Production                | `main`                           | Live product        | Customers                      |

See [deployment architecture](../docs/architecture/deployment-architecture.md)
and [cloud development](../docs/development/cloud-development.md) for the
mechanics (Vercel, Git-connected deployment).

## Release stages

1. **Internal only (Phases 0–4).** No external users. Foundation work
   only; nothing customer-facing exists yet.
2. **Closed alpha (targeted around the end of Horizon 2–3, Phases 8–12).**
   A small number of design-partner organizations exercise the core
   product loop end to end, under direct supervision, with expectations
   set that data may be reset.
3. **Closed beta (targeted around the end of Horizon 4, Phase 15).**
   Broader design-partner set; AI copilot, analytics, and audit are usable;
   billing is not yet enforced (or is enforced only in test mode).
4. **Paid general availability (after Horizon 5, Phase 20 complete, and
   Horizon 6 security/QA gates passed).** Billing enforced, external
   portal available, legal/trust readiness confirmed.

Stage advancement is gated by the exit criteria of the corresponding
phases in the [phase tracker](../docs/project/phase-tracker.md), not by
calendar date.

## Versioning

- The product itself is not versioned like a library (no semver on the
  SaaS app) — released continuously to `main` post-GA.
- Published **processes** and **knowledge documents** are versioned per
  the immutability rules in [terminology](terminology.md); this is a
  product concept, distinct from release versioning.
- Public API and integration surfaces (once they exist, Phase 18) will
  carry their own explicit versioning scheme, defined when that phase is
  scoped.

## Release gating

No stage advances until:

- The phase tracker shows all phases required for that stage as
  `Complete`, not `Partial`.
- Security hardening exit criteria relevant to that stage (Phase 22) are
  met for the surface area being exposed to that audience.
- [Success metrics](success-metrics.md) instrumentation needed to evaluate
  the stage is in place before the stage begins, not added retroactively.

## Related documents

- [Phase tracker](../docs/project/phase-tracker.md)
- [Roadmap](roadmap.md)
- [Deployment architecture](../docs/architecture/deployment-architecture.md)
