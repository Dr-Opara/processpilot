# Customer Offboarding Process

## Organization-initiated deletion (self-service, implemented)

An organization owner can request deletion from Organization Settings
(`requestOrganizationDeletion()`, Phase 21) — this requires typing the
organization's exact name as an elevated-confirmation step, then starts a
**14-day grace period** during which the request can be cancelled. The
actual data-deletion sweep is gated by `ORGANIZATION_DELETION_ENABLED`
(unset/disabled in every environment today) and intentionally throws
rather than deleting anything until a dedicated security review of the
cascade behavior happens — see
[organization-administration.md](../architecture/organization-administration.md).

## Individual member offboarding (implemented)

An organization admin can suspend or remove an individual member from
People without deleting the whole organization (`removeMember()`,
Phase 5) — the member's historical records (task history, audit trail)
are preserved per [data-ownership.md](../architecture/data-ownership.md)'s
"deactivate, don't delete" principle.

## Subscription cancellation (implemented)

Billing cancellation flows through Stripe (Phase 17); the organization's
entitlements are derived from Stripe's subscription state, so cancelling
there is reflected automatically, without a separate manual step.

## Data export before offboarding (implemented, self-service + admin-assisted)

- Any member can export their own profile/membership/activity from
  `/app/account` (Phase 25).
- An organization admin can export the full audit history from the audit
  center.
- A broader organization-content export (beyond audit history) is
  admin-assisted today (contact privacy@processpilot.com) — not yet a
  single-click self-service export of every resource type.

## Known gap

The organization-deletion finalization sweep is not implemented (see
above) — offboarding today means "suspended/inaccessible," not "data
physically removed," until that gated feature is enabled after security
review.

## Related documents

- [Organization administration](../architecture/organization-administration.md)
- [Data classification framework](data-classification.md)
