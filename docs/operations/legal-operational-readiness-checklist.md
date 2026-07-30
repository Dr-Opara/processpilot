# Legal and Operational Readiness Checklist (Phase 25)

Status legend: **Completed** (built and real, though possibly still
`draft` legal status), **Pending review** (built, needs attorney/human
sign-off before being relied upon), **Deferred** (intentionally not built
this phase, tracked for later), **Blocked** (cannot be completed without
something outside this codebase — real staffing, a real production
environment, or a paid service).

## Customer-facing legal pages

| Item                                                  | Status                                                                                                                     |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Terms of Service                                      | Completed — rewritten to reflect the real, built product. **Pending review** (attorney sign-off before "approved" status). |
| Privacy Policy                                        | Completed — rewritten. **Pending review.**                                                                                 |
| Acceptable Use Policy                                 | Completed (new). **Pending review.**                                                                                       |
| Subprocessors page                                    | Completed (new), sourced from real integrated providers.                                                                   |
| SaaS Data Processing Addendum (template)              | Completed (new). **Pending review** — template only, not an executable agreement.                                          |
| Professional Services Terms                           | Completed (new). **Pending review.**                                                                                       |
| Statement of Work template                            | Completed (new, outline only).                                                                                             |
| Independent Contractor engagement template            | Completed (new, outline only).                                                                                             |
| Trust Center hub                                      | Completed (new).                                                                                                           |
| Security disclosure / responsible-disclosure guidance | Completed — expanded existing `/security` page with GitHub private vulnerability reporting + safe-harbor language.         |

## Legal document governance

| Item                                                        | Status                                                                              |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Version + effective date + review-status field per document | Completed — `src/content/legal.ts`.                                                 |
| Draft vs. approved distinction visible on every legal page  | Completed — `LegalContent` status badge.                                            |
| Terms-of-service acceptance recording                       | Completed — recorded at onboarding completion (`recordTermsAcceptance()`), audited. |

## Data subject / customer rights

| Item                                                       | Status                                                                                                                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Self-service data export (own profile/membership/activity) | Completed — `/app/account`, `exportMyData()`.                                                                                                                      |
| Admin-assisted broader data export                         | Completed as a documented process (contact-based); **Deferred**: single-click full-organization export.                                                            |
| Data correction                                            | Completed — members can view their profile; admins can edit member records (pre-existing, Phase 5).                                                                |
| Account/organization deletion                              | Completed (Phase 21) — 14-day grace period, cancellable. **Blocked**: finalization sweep gated behind a dedicated security review, not enabled in any environment. |
| Individual member removal/offboarding                      | Completed (Phase 5).                                                                                                                                               |

## Operational procedures (documented)

All of the following are real, substantive documents under
`docs/operations/`, honestly labeled **Draft** where no real
production incident/staffing exists to validate them against:

- Incident response plan
- Breach notification workflow
- Business continuity plan
- Disaster recovery plan (restore **not yet tested** — see the document itself)
- Backup and restoration procedures
- Support escalation process
- Customer complaint process
- Service status communication process (**Deferred**: no public status page tool selected)
- Internal operational ownership matrix (**Blocked**: no real staffing to name)
- Production access procedures
- Change management procedures
- Release management procedures
- Vendor and subprocessor inventory
- Data classification framework
- Records of processing activities
- Customer security-questionnaire response library
- Publication/confidentiality approval process (for professional-services and client-engagement content)
- Customer offboarding process

## What's explicitly deferred or blocked, and why

- **Attorney review of every legal document** — Blocked. No outside
  counsel is engaged in this environment; every document is correctly
  labeled `draft` / `attorney_review_pending`, never `approved`.
- **Real production incident/DR drill** — Blocked. No production
  environment exists yet (Phase 26's job).
- **Named ownership matrix** — Blocked. No real staffing exists.
- **Signed DPAs with actual vendors** — Blocked. No commercial
  agreements exist with Clerk/Supabase/Vercel/Stripe/Resend/Anthropic
  beyond development-tier usage.
- **Organization-deletion finalization** — Deliberately gated pending a
  dedicated security review of the cascade behavior (Phase 21/22's own
  documented decision, not new to this phase).
- **Full self-service organization data export** — Deferred; the
  audit-export and self-service member export cover the highest-value
  cases today.

## Verification run for this phase

See the phase's own pull request for the live `npm run phase:commit`
result (format, lint, typecheck, unit tests, production build) plus
`npm audit`.

## Related documents

- [Phase tracker](../project/phase-tracker.md)
- [Backlog](../project/backlog.md)
