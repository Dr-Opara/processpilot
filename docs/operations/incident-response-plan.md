# Incident Response Plan

Status: **Draft — pending assignment of real on-call ownership.** ProcessPilot
has no production deployment or paying customers yet (see
[phase-tracker.md](../project/phase-tracker.md)), so this plan has not been
exercised against a real incident. It documents the process to follow once
production traffic exists.

## What counts as a security incident

Unauthorized access to customer data, confirmed cross-tenant data exposure,
a leaked credential/secret, active exploitation of a known vulnerability,
or a finding from [security-hardening.md](../architecture/security-hardening.md)
being actively exploited rather than theoretical.

## Severity levels

- **SEV1** — confirmed or highly likely cross-tenant data exposure, active
  exploitation, or full service outage.
- **SEV2** — a real vulnerability with no evidence of exploitation, or a
  partial outage affecting some but not all organizations.
- **SEV3** — a lower-risk finding with no immediate customer impact.

## Response steps

1. **Detect** — via `/api/ready` degraded/unavailable status, an error-
   reporting alert (once a real provider is configured — see
   [observability.md](../architecture/observability.md)), a customer report,
   or a security researcher's disclosure (see [SECURITY.md](../../SECURITY.md)).
2. **Triage** — assign a severity level within 1 hour of detection (SEV1)
   or 1 business day (SEV2/SEV3).
3. **Contain** — for a credential leak, rotate the credential immediately
   (see [environment-variables.md](../development/environment-variables.md)).
   For active exploitation, disable the affected route/feature if it can
   be done without a full deployment, or ship an emergency fix.
4. **Eradicate and recover** — fix the root cause, verify the fix with a
   regression test, deploy.
5. **Notify** — see [breach-notification-workflow.md](breach-notification-workflow.md)
   for when and how affected customers are notified.
6. **Post-incident review** — a written summary within 5 business days of
   resolution: what happened, root cause, what changed to prevent
   recurrence, and whether a new automated test was added.

## Ownership

Until real staffing exists, incident response is the responsibility of
whoever holds repository admin access. This section must be updated with
real names/roles before production launch — see
[legal-operational-readiness-checklist.md](legal-operational-readiness-checklist.md).

## Related documents

- [Breach notification workflow](breach-notification-workflow.md)
- [Business continuity plan](business-continuity-plan.md)
- [Security hardening](../architecture/security-hardening.md)
- [SECURITY.md](../../SECURITY.md)
