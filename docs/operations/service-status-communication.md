# Service Status Communication Process

Status: **Draft — no public status page exists yet.**

## What we have today

`/api/ready` (Phase 23) is machine-readable and can be polled by anyone,
but there is no human-readable public status page. This is a real gap,
not a hidden one.

## Intended process once a status page exists

1. A degraded/unavailable `/api/ready` result lasting more than 5 minutes
   triggers a status-page update (once a status-page tool is chosen —
   none is credentialed/configured in this environment).
2. Updates during an incident: acknowledge within 15 minutes of
   detection, then at least every 30 minutes until resolved.
3. Post-incident: a summary is posted within 24 hours of resolution,
   consistent with the incident-response plan's post-incident review.

## Interim process (today, no status page)

Until a status page exists, affected organizations are notified directly
by email for any incident lasting more than 15 minutes, using the same
escalation path as [support-escalation.md](support-escalation.md).

## Related documents

- [Incident response plan](incident-response-plan.md)
- [Support escalation](support-escalation.md)
