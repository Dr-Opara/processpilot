# Breach Notification Workflow

Status: **Draft — pending attorney review.** Notification timelines below
follow common regulatory patterns (e.g. GDPR's 72-hour authority
notification, U.S. state breach-notification laws' "without unreasonable
delay" standard) but have not been reviewed by counsel for the specific
jurisdictions ProcessPilot's customers operate in. Do not treat the
timelines below as a compliance guarantee until that review happens.

## Trigger

A confirmed [incident](incident-response-plan.md) involving unauthorized
access to, or disclosure of, personal data or organization content.

## Steps

1. **Confirm scope** — which organization(s), which data, how it happened,
   whether it's ongoing.
2. **Internal notification** — immediately to whoever holds repository
   admin access (see [incident-response-plan.md](incident-response-plan.md)'s
   ownership note).
3. **Customer notification** — affected organization owners/admins are
   notified without unreasonable delay once scope is confirmed, describing
   what happened, what data was involved, what we've done, and what the
   organization should do.
4. **Regulatory notification** — where required by law (e.g. GDPR's
   72-hour supervisory-authority notification for personal data breaches),
   handled with counsel's involvement — not something engineering
   determines unilaterally.
5. **Documentation** — every breach notification decision (notify / don't
   notify, and why) is recorded in writing, retained per
   [data-classification.md](data-classification.md)'s retention guidance.

## What we can technically verify quickly

`audit_events` (immutable since Phase 15) lets us reconstruct exactly
which actions touched which records and when — this is the primary tool
for scoping a breach's actual extent, not guesswork.

## Related documents

- [Incident response plan](incident-response-plan.md)
- [Data classification framework](data-classification.md)
- [Privacy Policy](../../src/app/privacy/page.tsx)
