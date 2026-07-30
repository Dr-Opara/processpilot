# Support Escalation Process

Status: **Draft — no support team exists yet.** Describes the intended
process once ProcessPilot has real customers and support staffing.

## Channels

- **In-product:** none built yet (no help-widget/chat integration).
- **Email:** support@processpilot.com (routing target, not yet a
  monitored real inbox in this environment).
- **Security-specific reports:** see [SECURITY.md](../../SECURITY.md) —
  routed separately from general support.

## Severity and escalation

| Level | Example                                                               | Target first response |
| ----- | --------------------------------------------------------------------- | --------------------- |
| P1    | Organization fully unable to access the product; suspected data issue | 1 business hour       |
| P2    | A specific feature broken with no workaround                          | 1 business day        |
| P3    | Cosmetic issue, question, feature request                             | 3 business days       |

A P1 that is also a security concern is escalated per
[incident-response-plan.md](incident-response-plan.md) in parallel with
the support response.

## What's already built to support this

- The [audit center](../architecture/audit-and-compliance.md) lets a
  support responder (with appropriate access) trace exactly what
  happened in an organization, when, and by whom — this is the primary
  tool for diagnosing a reported issue without guessing.
- `/api/ready` (Phase 23) surfaces whether the platform itself is
  degraded, so a report can be triaged as "platform issue" vs.
  "organization-specific" quickly.

## Known gap

No dedicated support-ticketing system is integrated. Phase 27's platform-
administration work adds internal visibility into organization health,
but not a customer-facing ticketing product.

## Related documents

- [Customer complaint process](customer-complaint-process.md)
- [Service status communication](service-status-communication.md)
