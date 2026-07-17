# Observability

Not implemented as of Phase 0 (see Phase 23: Reliability and observability
in the [phase tracker](../project/phase-tracker.md)). This document
defines the requirements that phase must satisfy.

## Pillars

1. **Structured logging** — server-side logs for API routes, server
   actions, and background job handlers, structured (not free-text) so
   they're queryable. Logs never include secrets or full evidence/file
   contents (see [SECURITY.md](../../SECURITY.md)) — reference IDs, not
   payloads.
2. **Error tracking** — unhandled exceptions in server and client code
   are captured with enough context to reproduce (route, organization
   scope reference — not raw tenant data, user action) without leaking
   sensitive data into a third-party error-tracking tool.
3. **Metrics** — the [success metrics](../../product/success-metrics.md)
   "platform health" category (uptime, P95 latency, cross-tenant isolation
   test pass rate, security scan pass rate) plus standard infra metrics
   (request rate, error rate, background job queue depth/failure rate).
4. **Audit trail** — distinct from operational observability;
   `AuditEvent` (see [domain model](domain-model.md)) is a product/
   compliance record, not a debugging tool, and is never used as a
   substitute for structured application logs or vice versa.

## Principles

- Observability tooling choice is deferred to Phase 23, but whatever is
  chosen must not become a place where tenant data leaks across
  organization boundaries — e.g. a shared error-tracking project must
  scrub or scope tenant-identifying payloads consistent with
  [multi-tenancy](multi-tenancy.md).
- Alerting thresholds are tied to the platform-health
  [success metrics](../../product/success-metrics.md), not invented ad
  hoc when Phase 23 starts.
- Every background job failure that exhausts its retry policy (see
  [event model](event-model.md)) must be visible in whatever
  observability tooling is chosen — silent job failure is treated as a
  reliability defect.

## Related documents

- [Event model](event-model.md)
- [Success metrics](../../product/success-metrics.md)
- [Deployment architecture](deployment-architecture.md)
