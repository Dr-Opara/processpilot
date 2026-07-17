# Success Metrics

Metrics are grouped by what they measure: product adoption, operational
value delivered to customers, and platform health. None of these are
instrumented yet (Phase 0 is documentation-only) — this document defines
what Phase 14 (Analytics) and later instrumentation must be able to
report.

## Adoption metrics

- Time from organization signup to first published process.
- Time from organization signup to first completed workflow.
- Percentage of invited members who complete at least one task within 14
  days of invitation.
- Weekly active members as a percentage of total seats.

## Operational value metrics (what customers get out of it)

- Workflow completion rate (completed vs. started, within expected
  window).
- Median cycle time per process, and trend over time.
- Exception rate per process and per location/department.
- Corrective-action closure rate and median time to close.
- Training compliance rate (percentage of assigned training completed on
  time) and certification currency (percentage of required certifications
  not expired).
- Audit readiness: percentage of completed workflows with complete
  evidence/approval trails (no gaps).

## AI-assist quality metrics

- Draft process acceptance rate (percentage of AI-proposed steps kept
  without material edit) — a proxy for extraction quality.
- Draft-to-publish time delta between AI-assisted and manually authored
  processes.

## Commercial metrics

- Trial-to-paid conversion rate.
- Net revenue retention.
- Seat expansion rate within existing accounts.
- Churn rate, segmented by tier (see [pricing hypotheses](pricing-hypotheses.md)).

## Platform health metrics

- Uptime / availability of app.processpilot.com.
- P95 latency for core authenticated views.
- Cross-tenant isolation test pass rate (must remain 100% — see
  [multi-tenancy](../docs/architecture/multi-tenancy.md)).
- Security scan (CodeQL, dependency review, secret scanning) pass rate on
  protected branches.

## Principle

A metric is only added to a live dashboard once it is real and measured —
per [product principles](product-principles.md), placeholder or
illustrative numbers never appear in customer-facing surfaces.

## Related documents

- [Roadmap](roadmap.md)
- [Pricing hypotheses](pricing-hypotheses.md)
- [Observability](../docs/architecture/observability.md)
